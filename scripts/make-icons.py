#!/usr/bin/env python3
"""
Generates the PWA icon set. Re-run after changing the mark:
    python3 scripts/make-icons.py

Deliberately drawn in code rather than checked in as a binary blob so the
icon is diffable and easy to restyle.
"""
from PIL import Image, ImageDraw

BG = (18, 18, 17)          # --surface-0 dark
CARD = (86, 86, 82)        # lifted off --surface-2 so bars stay legible at 32px
SERIES = [
    (57, 135, 229),        # --series-1
    (217, 89, 38),         # --series-2
    (25, 158, 112),        # --series-3
    (201, 133, 0),         # --series-4
]


def draw(size: int, maskable: bool = False) -> Image.Image:
    """A 4-row agenda glyph: one colored account dot + a bar per row."""
    s = size * 4  # supersample, downscale at the end for clean edges
    img = Image.new('RGBA', (s, s), BG + (255,))
    d = ImageDraw.Draw(img)

    # Maskable icons get squeezed into the platform's safe zone (inner 80%).
    pad = s * 0.26 if maskable else s * 0.18
    inner = s - 2 * pad
    rows = 4
    gap = inner * 0.09
    row_h = (inner - gap * (rows - 1)) / rows
    dot_r = row_h * 0.28

    for i in range(rows):
        y = pad + i * (row_h + gap)
        cy = y + row_h / 2
        cx = pad + dot_r

        d.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r],
                  fill=SERIES[i] + (255,))

        bar_x = cx + dot_r * 2.4
        bar_w = inner - (bar_x - pad)
        # Ragged widths read as text without being text.
        bar_w *= [1.0, 0.72, 0.88, 0.6][i]
        bar_h = row_h * 0.34
        d.rounded_rectangle(
            [bar_x, cy - bar_h / 2, bar_x + bar_w, cy + bar_h / 2],
            radius=bar_h / 2, fill=CARD + (255,),
        )

    return img.resize((size, size), Image.LANCZOS)


for size in (192, 512):
    draw(size).save(f'public/icon-{size}.png')
    draw(size, maskable=True).save(f'public/icon-maskable-{size}.png')

# iOS ignores the manifest's icons and uses this one. It also does not respect
# transparency, so it must be fully opaque — which draw() already is.
draw(180).save('public/apple-touch-icon.png')

draw(32).save('public/favicon-32.png')
print('wrote public/icon-{192,512}.png, icon-maskable-*, apple-touch-icon.png, favicon-32.png')
