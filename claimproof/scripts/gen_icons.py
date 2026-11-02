# Generates the PWA/extension icon set (geometric scan-brackets mark).
# Run from the project root: npm run gen:icons
from PIL import Image, ImageDraw
import os

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

VB = 64.0
# Obsidian & Champagne Palette
CHAMPAGNE = (212, 180, 131, 255)       # #D4B483 (Corner brackets)
CHAMPAGNE_LIGHT = (227, 200, 150, 255) # #E3C896 (Parcel box outline)
GOLD = (201, 164, 92, 255)             # #C9A45C (Lightning bolt)
BG = (11, 12, 14, 255)                 # #0B0C0E (Obsidian background)
BORDER = (34, 37, 43, 255)             # #22252B (Obsidian line strong)


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
        d.line([(cx, cy + dy * arm), (cx, cy)], fill=CHAMPAGNE, width=w)
        d.line([(cx, cy), (cx + dx * arm, cy)], fill=CHAMPAGNE, width=w)

    # Parcel box
    d.rounded_rectangle(
        [px(23, s), px(25, s), px(41, s), px(39, s)],
        radius=px(2.5, s),
        outline=CHAMPAGNE_LIGHT,
        width=max(2, int(px(3, s))),
    )

    # Lightning bolt
    bolt = [(35.5, 27.5), (30.5, 32.0), (33.9, 32.0), (31.5, 36.5), (37.1, 31.3), (33.7, 31.3)]
    d.polygon([(px(x, s), px(y, s)) for x, y in bolt], fill=GOLD)

    img = img.resize((size, size), Image.LANCZOS)
    img.save(path)
    print('wrote', path)


# Public PWA icons
os.makedirs(os.path.join('public', 'icons'), exist_ok=True)
make(512, os.path.join('public', 'icons', 'icon-512.png'))
make(192, os.path.join('public', 'icons', 'icon-192.png'))
make(128, os.path.join('public', 'icons', 'icon-128.png'))
make(48, os.path.join('public', 'icons', 'icon-48.png'))
make(32, os.path.join('public', 'icons', 'icon-32.png'))
make(16, os.path.join('public', 'icons', 'icon-16.png'))
make(512, os.path.join('public', 'icons', 'icon-maskable-512.png'), maskable=True)

# Extension icons (16, 32, 48, 128)
os.makedirs(os.path.join('extension', 'icons'), exist_ok=True)
make(128, os.path.join('extension', 'icons', 'icon-128.png'))
make(48, os.path.join('extension', 'icons', 'icon-48.png'))
make(32, os.path.join('extension', 'icons', 'icon-32.png'))
make(16, os.path.join('extension', 'icons', 'icon-16.png'))

print('icons done')
