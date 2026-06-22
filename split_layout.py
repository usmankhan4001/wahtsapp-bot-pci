"""Split a large layout PDF into per-page small PDFs (rasterized, readable, light).
Output: pdfs/split/<base>/page-NN.pdf
"""
import os, fitz

SRC = r"E:\Apps\PCI Whatsapp Bot\bot\pdfs\Grand Orchard Updated Layouts.pdf"
OUTDIR = r"E:\Apps\PCI Whatsapp Bot\bot\pdfs\split\grand-orchard-layouts"
DPI, QUALITY, MAXPX = 100, 62, 4000

os.makedirs(OUTDIR, exist_ok=True)
doc = fitz.open(SRC)
for i, page in enumerate(doc, 1):
    longest_in = max(page.rect.width, page.rect.height) / 72.0
    dpi = max(30, min(DPI, int(MAXPX / max(longest_in, 0.01))))
    pix = page.get_pixmap(dpi=dpi, alpha=False)
    jpg = pix.tobytes(output="jpeg", jpg_quality=QUALITY)
    out = fitz.open()
    p = out.new_page(width=page.rect.width, height=page.rect.height)
    p.insert_image(page.rect, stream=jpg)
    dst = os.path.join(OUTDIR, f"page-{i:02d}.pdf")
    out.save(dst, deflate=True, garbage=4)
    out.close()
    print(f"  page-{i:02d}.pdf  {os.path.getsize(dst)/1048576:.2f} MB")
print(f"DONE -> {OUTDIR}")
