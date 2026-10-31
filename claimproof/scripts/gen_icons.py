# Generates the PWA/extension icon set (geometric scan-brackets mark).
# Run from the project root: npm run gen:icons
from PIL import Image, ImageDraw
import os

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

VB = 64.0
BLUE = (59, 130, 246, 255)
BLUE_SOFT = (147, 197, 253, 255)
AMBER = (251, 191, 36, 255)
BG = (16, 19, 27, 255)
BORDER = (32, 38, 52, 255)


def px(v: float, s: int) -> float:
    return v * s / VB


def make(size: int, path: str, maskable: bool = False) -> None:
    ss = 4
    s = size * ss
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    radius = 0 if maskable else px(14, s)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=radius, fill=BG, outline=BORDER, width=max(1, int(px(1, s))))

    # Corner scan brackets
    w = max(2, int(px(4.5, s)))
    off = int(px(14, s))
    arm = int(px(9, s))
    for cx, cy, dx, dy in [
        (off, off, 1, 1),
        (s - off, off, -1, 1),
        (s - off, s - off, -1, -1),
        (off, s - off, 1, -1),
    ]:
        d.line([(cx, cy + dy * arm), (cx, cy)], fill=BLUE, width=w)
        d.line([(cx, cy), (cx + dx * arm, cy)], fill=BLUE, width=w)

    # Parcel box
    d.rounded_rectangle(
        [px(23, s), px(25, s), px(41, s), px(39, s)],
        radius=px(2.5, s),
        outline=BLUE_SOFT,
        width=max(2, int(px(3, s))),
    )

    # Lightning bolt
    bolt = [(35.5, 27.5), (30.5, 32.0), (33.9, 32.0), (31.5, 36.5), (37.1, 31.3), (33.7, 31.3)]
    d.polygon([(px(x, s), px(y, s)) for x, y in bolt], fill=AMBER)

    img = img.resize((size, size), Image.LANCZOS)
    img.save(path)
    print('wrote', path)


os.makedirs(os.path.join('public', 'icons'), exist_ok=True)
make(512, os.path.join('public', 'icons', 'icon-512.png'))
make(192, os.path.join('public', 'icons', 'icon-192.png'))
make(512, os.path.join('public', 'icons', 'icon-maskable-512.png'), maskable=True)
print('icons done')
