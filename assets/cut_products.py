"""Cut the apparel product shots off their white studio backgrounds.

White backdrop against dark garments unmixes cleanly: coverage is recovered
from how far each pixel sits from white, so anti-aliased edges keep true
partial alpha (crisp, no halo). Only background connected to the frame border
is removed, so white printing on the garment survives.
"""
from PIL import Image
import numpy as np
from scipy import ndimage
import os

HERE = os.path.dirname(__file__)
IMG = os.path.join(HERE, '..', 'site', 'assets', 'img')

JOBS = [
    ('shop-tee-mym.jpg',     'shop-tee-mym.webp'),
    ('drkem-flyer-card.jpg', 'shop-tee-summit.webp'),
    ('shop-nv-a.jpg',        'shop-hoodie.webp'),
]

for src, out in JOBS:
    a = np.array(Image.open(os.path.join(HERE, 'raw', src)).convert('RGB')).astype(np.float64)

    # distance below white -> coverage
    lum = a.min(axis=2)
    alpha = np.clip((246.0 - lum) / 26.0, 0.0, 1.0)

    # only strip background reachable from the frame edge; white print on the
    # garment is enclosed by fabric and must stay
    bg = alpha < 0.35
    lab, n = ndimage.label(bg)
    border = set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])
    border.discard(0)
    outside = np.isin(lab, list(border))
    alpha[~outside] = 1.0

    # drop dust specks floating in the backdrop
    solid = alpha > 0.5
    lab, n = ndimage.label(solid)
    if n:
        sizes = ndimage.sum(solid, lab, range(1, n + 1))
        keep = np.isin(lab, np.where(sizes > 1500)[0] + 1)
        alpha[~ndimage.binary_dilation(keep, iterations=3)] = 0.0

    # bite ~1px inward: JPEG ringing leaves near-white pixels right on the
    # boundary, which would read as a white fringe against a dark section
    alpha = ndimage.gaussian_filter(alpha, 0.5)
    alpha = np.clip((alpha - 0.22) / 0.72, 0, 1)

    # unmix the white backdrop out of edge pixels so no white halo remains
    safe = np.clip(alpha, 0.35, 1.0)[..., None]
    rgb = np.clip((a - 255.0 * (1 - safe)) / safe, 0, 255)

    # Despill the rim: the studio backdrop throws a bright highlight along the
    # garment's own edge. Those pixels are subject, not background, so erosion
    # cannot remove them — pull them down to the neighbouring fabric tone.
    visible = alpha > 0.02
    band = visible & ~ndimage.binary_erosion(visible, iterations=5)
    # grey erosion takes the local minimum: for a dark garment that is the
    # true fabric tone, unpolluted by the bright rim or the white backdrop
    fabric = np.stack([ndimage.grey_erosion(rgb[..., c], size=9) for c in range(3)], axis=2)
    hot = band & (rgb.min(axis=2) > fabric.min(axis=2) + 40)
    rgb[hot] = fabric[hot]

    ys, xs = np.where(alpha > 0.02)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    o = np.zeros((y1 - y0, x1 - x0, 4), dtype=np.uint8)
    o[..., :3] = np.round(rgb[y0:y1, x0:x1]).astype(np.uint8)
    o[..., 3] = np.round(alpha[y0:y1, x0:x1] * 255).astype(np.uint8)

    im = Image.fromarray(o)
    im.thumbnail((900, 900), Image.LANCZOS)
    im.save(os.path.join(IMG, out), quality=92, method=6)
    print(out, im.size)

# proof: all three composited on the shop section's dark green
tiles = []
for _, out in JOBS:
    p = np.array(Image.open(os.path.join(IMG, out)).convert('RGBA')).astype(np.float64)
    al = p[..., 3:4] / 255.0
    comp = np.array([10, 18, 12], dtype=np.float64) * (1 - al) + p[..., :3] * al
    t = Image.fromarray(comp.astype(np.uint8)); t.thumbnail((380, 420))
    tiles.append(t)
sheet = Image.new('RGB', (sum(t.width for t in tiles), max(t.height for t in tiles)), (10, 18, 12))
x = 0
for t in tiles:
    sheet.paste(t, (x, 0)); x += t.width
sheet.save(os.path.join(HERE, 'proof_products.png'))
print('proof written')
