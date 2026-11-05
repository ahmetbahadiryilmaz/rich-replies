"""Generates icon.png (512x512) for the rich-replies mod. Usage: python tools/make_icon.py"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

S = 512
img = Image.new("RGB", (S, S), "#111827")
d = ImageDraw.Draw(img)
d.rounded_rectangle((0, 0, S - 1, S - 1), radius=96, fill="#111827")

# Three progress bars: filled part in a status color, track in dark gray.
bars = [("#22c55e", 1.0), ("#eab308", 0.62), ("#3b82f6", 0.35)]
x0, x1, h, gap, y = 72, 440, 52, 28, 70
for color, frac in bars:
    d.rounded_rectangle((x0, y, x1, y + h), radius=26, fill="#1f2937")
    d.rounded_rectangle((x0, y, x0 + int((x1 - x0) * frac), y + h), radius=26, fill=color)
    y += h + gap

# "rr" monogram
font = None
for name in ("arialbd.ttf", "DejaVuSans-Bold.ttf", "segoeuib.ttf"):
    try:
        font = ImageFont.truetype(name, 190)
        break
    except OSError:
        pass
font = font or ImageFont.load_default()
d.text((S // 2, 400), "rr", font=font, fill="#f9fafb", anchor="mm")

out = Path(__file__).resolve().parent.parent / "icon.png"
img.save(out, optimize=True)
print("wrote", out)
