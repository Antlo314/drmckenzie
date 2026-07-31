"""Extract the Mind Your Mind lockup from the flyer as recolorable alpha masks.

Method: for each word, unmix pixel colors against the white background along
the (bg -> word-color) axis. The projection t recovers exact anti-aliased
coverage, so edges stay crisp and there is no white/color bleed. Pixels whose
color is not on that axis (other graphics) are rejected by residual distance.
Outputs: per-word alpha-mask PNGs (white + alpha) plus layout metadata JSON.
"""
from PIL import Image
import numpy as np
from scipy import ndimage
import json, os

SRC = os.path.join(os.path.dirname(__file__), 'raw', 'mym-capetown-2027.png')
OUT = os.path.join(os.path.dirname(__file__), '..', 'site', 'assets', 'logo')
os.makedirs(OUT, exist_ok=True)

im = np.array(Image.open(SRC).convert('RGB')).astype(np.float64)
H, W, _ = im.shape
BG = np.array([240.0, 240.0, 240.0])

# word: (representative color, bbox x0,y0,x1,y1 with margin, residual tolerance)
WORDS = {
    'mind':  ((84, 182, 134), (470, 40, 1540, 434), 38),
    'your':  ((182, 134, 70), (466, 436, 620, 780), 50),
    'mind2': ((20, 100, 84),  (600, 436, 1522, 772), 50),
}

meta = {}
for name, (color, (x0, y0, x1, y1), rtol) in WORDS.items():
    C = np.array(color, dtype=np.float64)
    axis = C - BG
    denom = float(axis @ axis)
    region = im[y0:y1, x0:x1]
    diff = region - BG
    t = np.clip((diff @ axis) / denom, 0.0, 1.0)          # coverage along bg->color
    recon = BG + t[..., None] * axis                       # what pure mixing would give
    resid = np.sqrt(((region - recon) ** 2).sum(axis=2))   # off-axis distance
    alpha = np.where(resid < rtol, t, 0.0)                 # reject other graphics
    alpha[alpha < 0.04] = 0.0                              # kill background noise

    # remove stray specks and ghost lines, keep real components (incl. i-dot)
    solid = alpha > 0.15
    lab, n = ndimage.label(solid)
    if n:
        for k in range(1, n + 1):
            sel = lab == k
            size = int(sel.sum())
            mean_a = float(alpha[sel].mean())
            # real glyphs are large and near-fully covered; ghosts of other
            # graphics (thin arcs) are small or only half-covered
            if size < 400 or mean_a < 0.6:
                alpha[sel] = 0.0
    # kill faint speck dust outside the kept glyphs (crisp edges, no bleed)
    keep = ndimage.binary_dilation(alpha > 0.15, iterations=3)
    alpha[~keep] = 0.0

    # tight bbox on the cleaned alpha, +2px pad
    ys, xs = np.where(alpha > 0)
    bx0, bx1 = max(0, xs.min() - 2), min(alpha.shape[1], xs.max() + 3)
    by0, by1 = max(0, ys.min() - 2), min(alpha.shape[0], ys.max() + 3)
    a = np.clip(alpha[by0:by1, bx0:bx1], 0, 1)

    out = np.zeros((a.shape[0], a.shape[1], 4), dtype=np.uint8)
    out[..., :3] = 255                                     # white; color comes from CSS
    out[..., 3] = np.round(a * 255).astype(np.uint8)
    Image.fromarray(out).save(os.path.join(OUT, f'{name}.png'))

    gx0, gy0 = x0 + bx0, y0 + by0                          # global coords
    meta[name] = {'x': int(gx0), 'y': int(gy0),
                  'w': int(bx1 - bx0), 'h': int(by1 - by0),
                  'color': '#%02x%02x%02x' % color}
    print(name, meta[name])

# lockup box that contains all words -> relative percentages for CSS layout
lx0 = min(m['x'] for m in meta.values()); ly0 = min(m['y'] for m in meta.values())
lx1 = max(m['x'] + m['w'] for m in meta.values()); ly1 = max(m['y'] + m['h'] for m in meta.values())
LW, LH = lx1 - lx0, ly1 - ly0
layout = {'lockup': {'w': LW, 'h': LH, 'aspect': round(LW / LH, 5)}, 'words': {}}
for name, m in meta.items():
    layout['words'][name] = {
        'left': round((m['x'] - lx0) / LW * 100, 3),
        'top': round((m['y'] - ly0) / LH * 100, 3),
        'width': round(m['w'] / LW * 100, 3),
        'height': round(m['h'] / LH * 100, 3),
        'color': m['color'],
    }
with open(os.path.join(OUT, 'layout.json'), 'w') as f:
    json.dump(layout, f, indent=1)
print('lockup', LW, 'x', LH, 'aspect', layout['lockup']['aspect'])

# combined single-mask lockup (all words in position) for og/favicon/simple use
comb = np.zeros((LH, LW), dtype=np.float64)
for name, m in meta.items():
    a = np.array(Image.open(os.path.join(OUT, f'{name}.png')))[..., 3] / 255.0
    yy, xx = m['y'] - ly0, m['x'] - lx0
    comb[yy:yy + m['h'], xx:xx + m['w']] = np.maximum(comb[yy:yy + m['h'], xx:xx + m['w']], a)
out = np.zeros((LH, LW, 4), dtype=np.uint8)
out[..., :3] = 255
out[..., 3] = np.round(comb * 255).astype(np.uint8)
Image.fromarray(out).save(os.path.join(OUT, 'lockup.png'))
print('wrote lockup.png')
