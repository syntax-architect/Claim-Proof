# Generates the PWA/extension icon set (geometric scan-brackets mark).
# Run from the project root: npm run gen:icons
from PIL import Image, ImageDraw
import os

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

VB = 64.0
# Obsidian & Champagne Palette
CHAMPAGNE = (212, 180, 131, 255)       # #D4B483 (unused, kept for reference)
GOLD = (201, 164, 92, 255)             # #C9A45C (Stamp fill)
BG = (11, 12, 14, 255)                 # #0B0C0E (Obsidian background)
BORDER = (34, 37, 43, 255)             # #22252B (Obsidian line strong)
INK = (20, 17, 10, 255)                # #14110A (On-accent check)
INK_SOFT = (20, 17, 10, 77)            # #14110A @ 30% (Inner keyline)

# Perforation notch centres on each stamp edge (stamp spans 10..54)
NOTCHES = [
    (23, 10), (32, 10), (41, 10),
    (23, 54), (32, 54), (41, 54),
    (10, 23), (10, 32), (10, 41),
    (54, 23), (54, 32), (54, 41),
]


def px(v: float, s: int) -> float:
    return v * s / VB


def make(size: int, path: str, maskable: bool = False) -> None:
    ss = 4
    s = size * ss
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    radius = 0 if maskable else px(14, s)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=radius, fill=BG, outline=BORDER, width=max(1, int(px(1, s))))

    # Proof stamp (perforated edges via plate-coloured notches)
    d.rounded_rectangle(
        [px(10, s), px(10, s), px(54, s), px(54, s)],
        radius=px(10, s),
        fill=GOLD,
    )
    notch_r = px(3, s)
    for cx, cy in NOTCHES:
        cxp, cyp = px(cx, s), px(cy, s)
        d.ellipse([cxp - notch_r, cyp - notch_r, cxp + notch_r, cyp + notch_r], fill=BG)

    # Inner official-seal keyline
    d.rounded_rectangle(
        [px(14.5, s), px(14.5, s), px(49.5, s), px(49.5, s)],
        radius=px(6.5, s),
        outline=INK_SOFT,
        width=max(1, int(px(1.5, s))),
    )

    # Verification check (round caps + joins)
    check_w = max(2, int(px(6.5, s)))
    pts = [(px(21.5, s), px(33, s)), (px(29, s), px(40.5, s)), (px(44, s), px(23, s))]
    d.line(pts, fill=INK, width=check_w, joint='curve')
    cap = check_w / 2
    for cxp, cyp in (pts[0], pts[-1]):
        d.ellipse([cxp - cap, cyp - cap, cxp + cap, cyp + cap], fill=INK)

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
