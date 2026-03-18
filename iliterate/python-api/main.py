import os
import re
import secrets
from fastapi import FastAPI, Header, HTTPException
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
