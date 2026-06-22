"""RAG ingest with OCR fallback (Python, uses Gemini for OCR + embeddings).
Reads media-source/<Project>/*.pdf, extracts text per page; OCRs low-text pages
via Gemini vision; chunks; embeds with gemini-embedding-001; writes
rag-index/vectors.json in the format the bot's VectorStore expects.

Run: GEMINI_API_KEY=... uv run --with pymupdf --with requests --python 3.11 ingest_rag.py
"""
import os, sys, json, base64, time
import fitz  # PyMuPDF
import requests

KEY = os.environ["GEMINI_API_KEY"]
EMBED_MODEL = os.environ.get("GEMINI_EMBED_MODEL", "gemini-embedding-001")
VISION_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
SRC = r"E:\Apps\PCI Whatsapp Bot\bot\media-source"
OUT = r"E:\Apps\PCI Whatsapp Bot\bot\rag-index\vectors.json"
CHUNK, OVERLAP, MIN_TEXT = 900, 150, 120
BASE = "https://generativelanguage.googleapis.com/v1beta/models"


def _post(url, body, timeout, tries=4):
    last = None
    for a in range(tries):
        try:
            r = requests.post(url, json=body, timeout=timeout)
            if r.status_code == 429 or r.status_code >= 500:
                last = f"{r.status_code}"; time.sleep(2 * (a + 1)); continue
            return r
        except Exception as e:
            last = str(e); time.sleep(2 * (a + 1))
    raise RuntimeError(f"request failed after {tries}: {last}")


def embed(text):
    r = _post(f"{BASE}/{EMBED_MODEL}:embedContent?key={KEY}",
              {"model": f"models/{EMBED_MODEL}", "content": {"parts": [{"text": text}]}}, 60)
    r.raise_for_status()
    return r.json()["embedding"]["values"]


def ocr_page(pix_jpeg_b64):
    body = {"contents": [{"parts": [
        {"text": "Extract ALL readable text from this real-estate document page. "
                 "Include prices, tables, and labels as plain text. If empty, reply with nothing."},
        {"inline_data": {"mime_type": "image/jpeg", "data": pix_jpeg_b64}},
    ]}]}
    try:
        r = _post(f"{BASE}/{VISION_MODEL}:generateContent?key={KEY}", body, 120)
        if not r.ok:
            return ""
        return r.json()["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        print(f"   ocr skip: {e}")
        return ""


def chunks(text):
    t = " ".join(text.split())
    return [t[i:i + CHUNK] for i in range(0, len(t), CHUNK - OVERLAP)] if t else []


records, rid = [], 0
projects = [d for d in sorted(os.listdir(SRC)) if os.path.isdir(os.path.join(SRC, d))]
for proj in projects:
    pdir = os.path.join(SRC, proj)
    for fn in sorted(os.listdir(pdir)):
        if not fn.lower().endswith(".pdf"):
            continue
        path = os.path.join(pdir, fn)
        doc = fitz.open(path)
        text_parts, ocr_pages = [], 0
        for page in doc:
            t = page.get_text().strip()
            if len(t) < MIN_TEXT:  # likely image-only → OCR
                pix = page.get_pixmap(dpi=150, alpha=False)
                b64 = base64.b64encode(pix.tobytes(output="jpeg", jpg_quality=80)).decode()
                ocr = ocr_page(b64).strip()
                if len(ocr) > len(t):
                    t, _ = ocr, ocr_pages
                    ocr_pages += 1
            if t:
                text_parts.append(t)
        full = "\n".join(text_parts)
        cks = chunks(full)
        ok = 0
        for c in cks:
            try:
                records.append({"id": f"c{rid}", "project": proj, "source": fn,
                                "text": c, "embedding": embed(c)})
                rid += 1
                ok += 1
            except Exception as e:
                print(f"   embed fail: {e}")
                time.sleep(2)
        print(f"  {proj} / {fn}: {len(cks)} chunks, {ocr_pages} OCR pages, {ok} embedded")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(records, f)
print(f"\nDONE: {len(records)} chunks from {len(projects)} projects -> {OUT}")
