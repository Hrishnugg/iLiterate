import re
from fastapi import FastAPI
from pydantic import BaseModel
from lindera import load_dictionary, Tokenizer

app = FastAPI()

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


class TokenizeRequest(BaseModel):
    text: str
    language: str

@app.post("/tokenize")
def tokenize(req: TokenizeRequest):
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
