"""Compress PDFs to small sizes for WhatsApp sending.
Rasterizes each page to a JPEG at a modest DPI and rebuilds the PDF.
Originals are kept; output goes to pdfs/compressed/.
Run: uv run --with pymupdf --python 3.11 compress_pdfs.py [DPI] [QUALITY]
"""
import os
import sys
import shutil
import fitz  # PyMuPDF

SRC = r"E:\Apps\PCI Whatsapp Bot\bot\pdfs"
OUT = os.path.join(SRC, "compressed")
DPI = int(sys.argv[1]) if len(sys.argv) > 1 else 110
QUALITY = int(sys.argv[2]) if len(sys.argv) > 2 else 65
ONLY = sys.argv[3].lower() if len(sys.argv) > 3 else None  # only process names containing this
MAX_PX = int(sys.argv[4]) if len(sys.argv) > 4 else 60000  # cap longest side (px)

os.makedirs(OUT, exist_ok=True)
total_before = total_after = 0


def rasterize(src, dst):
    doc = fitz.open(src)
    out = fitz.open()
    for page in doc:
        # Per-page DPI: never let the longest side exceed MAX_PX.
        longest_in = max(page.rect.width, page.rect.height) / 72.0
        dpi = min(DPI, int(MAX_PX / max(longest_in, 0.01)))
        dpi = max(dpi, 30)
        pix = page.get_pixmap(dpi=dpi, alpha=False)
        jpg = pix.tobytes(output="jpeg", jpg_quality=QUALITY)
        newpage = out.new_page(width=page.rect.width, height=page.rect.height)
        newpage.insert_image(page.rect, stream=jpg)
    out.save(dst, deflate=True, garbage=4)
    out.close()
    doc.close()


for name in sorted(os.listdir(SRC)):
    if not name.lower().endswith(".pdf"):
        continue
    if ONLY and ONLY not in name.lower():
        continue
    src = os.path.join(SRC, name)
    dst = os.path.join(OUT, name)
    b = os.path.getsize(src)
    try:
        tmp = dst + ".tmp"
        rasterize(src, tmp)
        a = os.path.getsize(tmp)
        # Keep whichever is smaller — rasterizing text PDFs can bloat them.
        if a < b:
            os.replace(tmp, dst)
            note = ""
        else:
            os.remove(tmp)
            shutil.copyfile(src, dst)
            a = b
            note = "  (kept original — already smaller)"
        total_before += b
        total_after += a
        print(f"{b/1048576:7.2f}MB -> {a/1048576:6.2f}MB  {name}{note}")
    except Exception as e:
        # On failure, copy the original so the file still exists in compressed/.
        try:
            shutil.copyfile(src, dst)
        except Exception:
            pass
        total_before += b
        total_after += b
        print(f"{b/1048576:7.2f}MB -> {b/1048576:6.2f}MB  {name}  (FAILED, kept original: {e})")

print(f"\nTOTAL  {total_before/1048576:.1f}MB -> {total_after/1048576:.1f}MB"
      f"  ({100*(1-total_after/max(total_before,1)):.0f}% smaller)")
print(f"Output: {OUT}")
