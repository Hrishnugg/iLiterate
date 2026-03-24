import os
import re
import secrets
from fastapi import FastAPI, Header, HTTPException
import requests
import tempfile
import os
import json
from datetime import datetime
from langdetect import detect
from ebooklib import epub
from pdfminer.high_level import extract_text as extract_pdf_text
import html
import re
from pydantic import BaseModel
from lindera import load_dictionary, Tokenizer
from wordfreq import zipf_frequency

app = FastAPI()
_SHARED_SECRET = os.getenv("PYTHON_API_SHARED_SECRET", "").strip()

# Punctuation that should be attached to the preceding word
_TRAILING_PUNCT = re.compile(
    r'^[。、！？，；：」』】〕》〉…—～·\.,!?;:\'\"\)\]\}]+$'
)
# Punctuation that should be attached to the following word
_LEADING_PUNCT = re.compile(
    r'^[「『【〔《〈\(\[\{\"\']+$'
)


def _merge_punctuation(tokens: list[str]) -> list[str]:
    result: list[str] = []
    i = 0
    while i < len(tokens):
        token = tokens[i]
        if _TRAILING_PUNCT.match(token) and result:
            result[-1] += token
            i += 1
        elif _LEADING_PUNCT.match(token) and i + 1 < len(tokens):
            result.append(token + tokens[i + 1])
            i += 2
        else:
            result.append(token)
            i += 1
    return result


# Map human-readable language names (as stored in the DB) to ISO 639-1 codes for wordfreq
_LANG_CODES: dict[str, str] = {
    "arabic": "ar",
    "chinese": "zh",
    "chinese (simplified)": "zh",
    "chinese (traditional)": "zh",
    "english": "en",
    "french": "fr",
    "german": "de",
    "hindi": "hi",
    "italian": "it",
    "japanese": "ja",
    "korean": "ko",
    "portuguese": "pt",
    "russian": "ru",
    "spanish": "es",
}

# Words whose surface form is entirely non-alphabetic (numbers, punctuation) get
# a neutral multiplier instead of being penalised as unknown words.
_ALPHA_RE = re.compile(r'[^\W\d_]', re.UNICODE)


def _word_multiplier(word: str, lang_code: str) -> float:
    """Return a display-time multiplier for one word relative to the base WPM.

    < 1.0  → show the word faster (very common / easy word)
    = 1.0  → neutral
    > 1.0  → show the word slower (rare / complex word)

    The formula maps the Zipf frequency scale (0–8, higher = more common) to
    a linear multiplier anchored at zipf=4 (≈ moderately common word):
        multiplier = 1 + (4 - zipf) * 0.15
    Examples:
        zipf 6 (common, like "house")  → 0.70  (30 % faster)
        zipf 4 (moderate)              → 1.00  (base speed)
        zipf 2 (rare)                  → 1.30  (30 % slower)
        zipf 0 (very rare / unknown)   → 1.60  (60 % slower)
    Clamped to [0.5, 2.0].
    """
    if not _ALPHA_RE.search(word):
        return 1.0
    freq = zipf_frequency(word.lower(), lang_code)
    multiplier = 1.0 + (4.0 - freq) * 0.15
    return max(0.5, min(2.0, multiplier))


class WordDifficultyRequest(BaseModel):
    words: list[str]
    language: str


class TokenizeRequest(BaseModel):
    text: str
    language: str


class ProcessUploadRequest(BaseModel):
    storage_path: str | None
    public_url: str | None
    upload_id: str | None
    user_id: str | None
    language: str | None


def _verify_authorization(authorization: str | None) -> None:
    if not _SHARED_SECRET:
        return

    expected = f"Bearer {_SHARED_SECRET}"
    if authorization is None or not secrets.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.post("/word-difficulty")
def word_difficulty(
    req: WordDifficultyRequest, authorization: str | None = Header(default=None)
):
    _verify_authorization(authorization)
    lang_code = _LANG_CODES.get(req.language.lower(), "en")
    difficulties = [_word_multiplier(w, lang_code) for w in req.words]
    return {"difficulties": difficulties}


@app.post("/tokenize")
def tokenize(req: TokenizeRequest, authorization: str | None = Header(default=None)):
    _verify_authorization(authorization)
    lang = req.language.lower()
    if "japanese" in lang:
        dictionary = load_dictionary("embedded://ipadic")
    elif "korean" in lang:
        dictionary = load_dictionary("embedded://ko-dic")
    else:  # chinese
        dictionary = load_dictionary("embedded://cc-cedict")
    tokenizer = Tokenizer(dictionary, mode="normal")
    tokens = tokenizer.tokenize(req.text)
    words = [t.surface for t in tokens if t.surface.strip()]
    words = _merge_punctuation(words)
    return {"tokens": words}


@app.post("/process-upload")
def process_upload(req: ProcessUploadRequest, authorization: str | None = Header(default=None)):
    _verify_authorization(authorization)

    SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    UPLOADS_BUCKET = os.getenv("UPLOADS_BUCKET", "uploads")

    storage_path = req.storage_path
    public_url = req.public_url
    upload_id = req.upload_id
    detected_language = None

    if not public_url and storage_path and SUPABASE_URL and SUPABASE_SERVICE_ROLE:
        # Attempt to create a signed URL using Supabase Storage REST API
        try:
            sign_url = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/sign/{UPLOADS_BUCKET}/{storage_path}"
            resp = requests.post(sign_url, headers={
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE}",
                "apikey": SUPABASE_SERVICE_ROLE,
                "Content-Type": "application/json",
            }, json={"expiresIn": 3600}, timeout=15)
            if resp.ok:
                j = resp.json()
                # try common keys
                public_url = j.get("signedURL") or j.get("signed_url") or j.get("signedUrl") or j.get("signed_url")
        except Exception as e:
            print("Signed URL request failed:", e)

    if not public_url:
        raise HTTPException(status_code=400, detail="No public_url or signed url available for download")

    # Download file to temp
    try:
        r = requests.get(public_url, stream=True, timeout=60)
        r.raise_for_status()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to download file: {e}")

    # Determine extension
    filename = storage_path or public_url.split("/")[-1]
    ext = filename.lower().split(".")[-1] if "." in filename else "pdf"

    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmpf:
        for chunk in r.iter_content(chunk_size=8192):
            if chunk:
                tmpf.write(chunk)
        tmp_path = tmpf.name

    extracted_text = ""
    try:
        if ext in ["pdf"]:
            extracted_text = extract_pdf_text(tmp_path)
        elif ext in ["epub"]:
            book = epub.read_epub(tmp_path)
            parts = []
            for item in book.get_items():
                if item.get_type() == epub.ITEM_DOCUMENT:
                    try:
                        txt = item.get_content().decode("utf-8", errors="ignore")
                        # strip HTML tags simply
                        txt = re.sub(r"<[^>]+>", "", txt)
                        txt = html.unescape(txt)
                        parts.append(txt)
                    except Exception:
                        continue
            extracted_text = "\n\n".join(parts)
        else:
            # try to decode as text fallback
            with open(tmp_path, "rb") as fh:
                try:
                    extracted_text = fh.read().decode("utf-8", errors="ignore")
                except Exception:
                    extracted_text = ""
    except Exception as e:
        # Clean up temp and report
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Failed to extract text: {e}")

    # Basic language detection
    try:
        if req.language:
            detected_language = req.language
        else:
            sample = (extracted_text or "").strip()[:2000]
            if sample:
                detected_language = detect(sample)
    except Exception:
        detected_language = None

    # Update Supabase records via REST API if service role provided
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE and upload_id:
        try:
            rest_url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/user_uploads?id=eq.{upload_id}"
            now = datetime.utcnow().isoformat() + "Z"
            body = {"extracted_text": extracted_text, "processed_at": now, "language_detected": detected_language}
            headers = {
                "apikey": SUPABASE_SERVICE_ROLE,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            }
            resp = requests.patch(rest_url, headers=headers, data=json.dumps(body), timeout=15)
            if not resp.ok:
                print("Failed to update user_uploads:", resp.status_code, resp.text)
        except Exception as e:
            print("Error updating user_uploads:", e)

    # Also update content row if source_url matches
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE and public_url:
        try:
            rest_url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/content?source_url=eq.{requests.utils.requote_uri(public_url)}"
            now = datetime.utcnow().isoformat() + "Z"
            word_count = len((extracted_text or "").split()) if extracted_text else None
            body = {"body": extracted_text, "word_count": word_count, "updated_at": now}
            headers = {
                "apikey": SUPABASE_SERVICE_ROLE,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            }
            resp = requests.patch(rest_url, headers=headers, data=json.dumps(body), timeout=15)
            if not resp.ok:
                print("Failed to update content row:", resp.status_code, resp.text)
        except Exception as e:
            print("Error updating content row:", e)

    # Clean up temp file
    try:
        os.unlink(tmp_path)
    except Exception:
        pass

    return {"status": "processed", "upload_id": upload_id, "language_detected": detected_language}
