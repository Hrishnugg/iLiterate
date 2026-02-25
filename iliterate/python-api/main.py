from fastapi import FastAPI
from pydantic import BaseModel
from lindera import load_dictionary, Tokenizer

app = FastAPI()

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
    return {"tokens": words}
