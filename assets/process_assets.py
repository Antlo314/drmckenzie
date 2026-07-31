"""Process raw site assets into web-ready files under site/assets/.

- Extracts the brush-script "Kem" from the hero banner as a recolorable
  alpha mask (white + alpha, crisp unmixed edges).
- Trims transparent padding from cutout PNGs, verifies no background bleed.
- Resizes and compresses everything for the web (WebP; masks stay PNG).
"""
from PIL import Image
import numpy as np
from scipy import ndimage
import os

RAW = os.path.join(os.path.dirname(__file__), 'raw')
IMG = os.path.join(os.path.dirname(__file__), '..', 'site', 'assets', 'img')
LOGO = os.path.join(os.path.dirname(__file__), '..', 'site', 'assets', 'logo')
os.makedirs(IMG, exist_ok=True)

# ---------------------------------------------------------------- script Kem
src = np.array(Image.open(os.path.join(RAW, 'hero-kem19.png')).convert('RGB')).astype(np.float64)
region = src[900:2350, 2900:4700]
minc = region.min(axis=2)
t = np.clip((minc - 150.0) / (250.0 - 150.0), 0.0, 1.0)   # whiteness coverage
# zero the page-background band below the banner: contiguous near-pure-white
# full-width rows, walking up from the bottom edge only
row_white = t.mean(axis=1) > 0.92
y = t.shape[0] - 1
while y >= 0 and row_white[y]:
    t[y] = 0.0
    y -= 1
alpha = t.copy()
solid = alpha > 0.4
lab, n = ndimage.label(solid)
sizes = ndimage.sum(solid, lab, range(1, n + 1))
big = np.zeros_like(solid)
for k in np.where(sizes >= 2500)[0] + 1:
    sel = lab == k
    cy, cx = ndimage.center_of_mass(sel)
    if cy < 140 and cx > 950:        # "Dr." / COACHING WITH remnants, top-right
        continue
    big |= sel
keepzone = ndimage.binary_dilation(big, iterations=15)      # keep brush distress specks
alpha[~keepzone] = 0.0
ys, xs = np.where(alpha > 0.02)
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
a = alpha[y0:y1, x0:x1]
out = np.zeros((a.shape[0], a.shape[1], 4), dtype=np.uint8)
out[..., :3] = 255
out[..., 3] = np.round(a * 255).astype(np.uint8)
kem = Image.fromarray(out)
kem.thumbnail((1200, 1200), Image.LANCZOS)
kem.save(os.path.join(LOGO, 'kem-script.png'))
print('kem-script', kem.size)

# ------------------------------------------------------- cutout trim helper
def trim_alpha(im, thresh=8):
    a = np.array(im)[..., 3]
    ys, xs = np.where(a > thresh)
    return im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))

def save_cutout(name, out, maxw, maxh=None):
    im = Image.open(os.path.join(RAW, name)).convert('RGBA')
    im = trim_alpha(im)
    im.thumbnail((maxw, maxh or maxw), Image.LANCZOS)
    im.save(os.path.join(IMG, out), lossless=False, quality=90, method=6)
    print(out, im.size)

save_cutout('drkem-portrait-final.png', 'portrait-full.webp', 1100, 1500)
save_cutout('kem-edited-plans.png', 'portrait-night.webp', 1100, 1500)
# portrait-leopard / mym-2025-flyer: processed but unused by the current page
save_cutout('drkem-portrait-img0480.png', 'portrait-thankful.webp', 900, 1100)
save_cutout('phone-mockup-nightvision.png', 'mock-phones.webp', 1300)
save_cutout('book-mockup-nightvision.png', 'mock-bookstack.webp', 1300)
save_cutout('ebook-mockup.png', 'mock-ebook.webp', 900)

# ------------------------------------------------------------- flat photos
def save_photo(name, out, maxw, quality=84, crop=None):
    im = Image.open(os.path.join(RAW, name)).convert('RGB')
    if crop:
        im = im.crop(crop)
    im.thumbnail((maxw, maxw), Image.LANCZOS)
    im.save(os.path.join(IMG, out), quality=quality, method=6)
    print(out, im.size)

# NOTE: the three apparel shots below still carry their white studio backdrop.
# cut_products.py MUST run after this script — it overwrites them with proper
# transparent cutouts. Run order: extract_logo -> process_assets -> cut_products.
save_photo('drkem-flyer-card.jpg', 'shop-tee-summit.webp', 900)
save_photo('shop-tee-mym.jpg', 'shop-tee-mym.webp', 900)
save_photo('shop-nv-a.jpg', 'shop-hoodie.webp', 900)
save_photo('shop-nv-b.jpg', 'book-kem.webp', 900)
save_photo('studyguide-journal.jpeg', 'book-studyguide.webp', 900)
# Dr. Kem on flat green from the summit banner (right-side crop, green kept for CSS blend)
save_photo('kem12-mym.png', 'mym-drkem-green.webp', 1200, crop=(1150, 130, 2900, 2130))
# sample the flat green for CSS
g = np.array(Image.open(os.path.join(RAW, 'kem12-mym.png')).convert('RGB'))[200:260, 200:260]
print('summit-green', '#%02x%02x%02x' % tuple(g.reshape(-1, 3).mean(axis=0).astype(int)))
