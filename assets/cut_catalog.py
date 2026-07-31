"""Prepare the 18 shop products for the rebuilt catalog page.

Apparel shot on a white studio backdrop gets the same matte treatment as the
homepage cutouts (unmix for true partial alpha, background removal limited to
regions touching the frame, rim despill). Book and journal covers are artwork
edge to edge, so they stay flat.
"""
from PIL import Image
import numpy as np
from scipy import ndimage
import json, os

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, 'raw', 'shop')
OUT = os.path.join(HERE, '..', 'site', 'assets', 'img', 'shop')
os.makedirs(OUT, exist_ok=True)

prods = json.load(open(os.path.join(HERE, 'wix', 'products.json')))

# covers are full-bleed artwork; everything else is apparel on white
COVERS = {'k-e-m-book', 'k-e-m-book-journal', 'k-e-m-study-guide-journal',
          'mind-your-manuscript', 'night-vision-book-journal',
          'night-vision-the-journal',
          'night-vision-how-to-see-your-way-though-any-situation'}


def cutout(path):
    a = np.array(Image.open(path).convert('RGB')).astype(np.float64)
    lum = a.min(axis=2)
    alpha = np.clip((246.0 - lum) / 26.0, 0.0, 1.0)

    bg = alpha < 0.35
    lab, n = ndimage.label(bg)
    border = set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])
    border.discard(0)
    alpha[~np.isin(lab, list(border))] = 1.0

    solid = alpha > 0.5
    lab, n = ndimage.label(solid)
    if n:
        sizes = ndimage.sum(solid, lab, range(1, n + 1))
        keep = np.isin(lab, np.where(sizes > 1500)[0] + 1)
        alpha[~ndimage.binary_dilation(keep, iterations=3)] = 0.0

    alpha = ndimage.gaussian_filter(alpha, 0.5)
    alpha = np.clip((alpha - 0.22) / 0.72, 0, 1)

    safe = np.clip(alpha, 0.35, 1.0)[..., None]
    rgb = np.clip((a - 255.0 * (1 - safe)) / safe, 0, 255)

    visible = alpha > 0.02
    band = visible & ~ndimage.binary_erosion(visible, iterations=5)
    fabric = np.stack([ndimage.grey_erosion(rgb[..., c], size=9) for c in range(3)], axis=2)
    hot = band & (rgb.min(axis=2) > fabric.min(axis=2) + 40)
    rgb[hot] = fabric[hot]

    ys, xs = np.where(alpha > 0.02)
    if len(xs) == 0:
        return None
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    o = np.zeros((y1 - y0, x1 - x0, 4), dtype=np.uint8)
    o[..., :3] = np.round(np.clip(rgb[y0:y1, x0:x1], 0, 255)).astype(np.uint8)
    o[..., 3] = np.round(alpha[y0:y1, x0:x1] * 255).astype(np.uint8)
    return Image.fromarray(o)


done = {}
for p in prods:
    src = os.path.join(SRC, p['file'])
    is_cover = p['slug'] in COVERS
    out_name = ('cover-' if is_cover else 'cut-') + os.path.splitext(p['file'])[0].split('_')[-1][:12] + '.webp'
    p['web'] = 'assets/img/shop/' + out_name
    p['cover'] = is_cover
    if out_name in done:
        continue
    if is_cover:
        im = Image.open(src).convert('RGB')
    else:
        im = cutout(src)
        if im is None:
            im = Image.open(src).convert('RGB')
    im.thumbnail((760, 760), Image.LANCZOS)
    im.save(os.path.join(OUT, out_name), quality=88, method=6)
    done[out_name] = im.size
    print(('cover ' if is_cover else 'cutout') , out_name, im.size)

json.dump(prods, open(os.path.join(HERE, 'wix', 'products.json'), 'w'), indent=1)
print('\nproducts:', len(prods), 'images:', len(done))
