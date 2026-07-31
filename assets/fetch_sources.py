"""Re-download the original imagery from the live Wix CDN.

assets/raw/ is ~73 MB and every file is a byte-for-byte copy of something the
CDN still serves, so it is kept out of git. Run this once after a fresh clone
and the whole pipeline (extract_logo -> process_assets -> cut_products ->
cut_catalog -> build_pages) works again.

    python fetch_sources.py
"""
import json, os, urllib.request

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, 'raw')
CDN = 'https://static.wixstatic.com/media/'

# local name -> media id on the Wix CDN
SOURCES = {
    'hero-kem19.png': 'c93b3a_99e9cb6a668b462ba898aa7cce160113~mv2.png',
    'phone-mockup-nightvision.png': 'c93b3a_f6e842f9898e42a6a34413f706dec689~mv2.png',
    'book-mockup-nightvision.png': 'c93b3a_1587cb68ab794824b05d62886a860281~mv2.png',
    'kem7-home.png': 'c93b3a_af3855a95e73459a85ac5275632a3abb~mv2.png',
    'drkem-portrait-final.png': '329d6d_0ae13a2a25af4c1ebfc71d749327e5fd~mv2.png',
    'drkem-portrait-img0480.png': '329d6d_77b04e7aa42d48e5a03bc7d659edb4de~mv2.png',
    'banner-7f8f.png': 'c93b3a_7f8f7842f74a40c6b6f9a94d29aa9b61~mv2.png',
    'kem-logo-og.png': '329d6d_f47c4817f91f4d8a8467ce3dece9dcf5~mv2.png',
    'bg-texture.jpg': '11062b_4b7c9a8e48334d5aad2fd274fddba3bc~mv2.jpg',
    'mym-2025-flyer.jpg': 'c93b3a_61fac8f0080c48c5a364f160fb73d058~mv2.jpg',
    'mym-20.jpg': 'c93b3a_162652aefea9470183be7023cf57dfe9~mv2.jpg',
    'mym-capetown-2027.png': 'c93b3a_92d76050000845528af1a6edfd024e08~mv2.png',
    'drkem-flyer-card.jpg': 'c93b3a_7c97aa2c26234e72ac274f51f6239164~mv2.jpg',
    'kem12-mym.png': 'c93b3a_cedf601a2b1a4bc08dd6a7ae1afe6345~mv2.png',
    'books-img6276.png': 'c93b3a_8e5183f3cb22476eb64e7900a4a94012~mv2.png',
    'ebook-mockup.png': 'c93b3a_a1e5d913d18d4e08858afa9345b6fc6c~mv2.png',
    'studyguide-journal.jpeg': 'c93b3a_758433238c514d539fd159671d3f139a.jpeg',
    'about5-8M7A1353.jpeg': 'c93b3a_e87fca35122d421c999924c319cac548~mv2.jpeg',
    'kem20-missions.png': 'c93b3a_21995e957df840a3b9da6ce4d6376167~mv2.png',
    'kem17-consulting.png': 'c93b3a_72436d6e74f34fa7a61545f5a1aca681~mv2.png',
    'kem11-booking.jpg': 'c93b3a_4e59e50243004312af3d26f3fde8074d~mv2.jpg',
    'kem-edited-plans.png': '329d6d_c97e67c2e6d14030bf0d73144f6d66a7~mv2.png',
    'shop-tee-mym.jpg': 'c93b3a_19a5ab5bb55747e598752742e3bea3f2~mv2.jpg',
    'shop-nv-a.jpg': 'c93b3a_9669b1cf16494f709fe82dbb52737b1d~mv2.jpg',
    'shop-nv-b.jpg': 'c93b3a_68f48d63a19c4ceb8a6218e9c8e8b38e~mv2.jpg',
}


def get(url, dest):
    if os.path.exists(dest):
        return False
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    urllib.request.urlretrieve(url, dest)
    return True


n = 0
for name, media in SOURCES.items():
    if get(CDN + media, os.path.join(RAW, name)):
        n += 1
        print('  ', name)

# the 18 catalog images come straight out of products.json
cat = json.load(open(os.path.join(HERE, 'wix', 'products.json')))
for p in cat:
    if p.get('img'):
        if get(p['img'], os.path.join(RAW, 'shop', p['file'])):
            n += 1
            print('  ', 'shop/' + p['file'])

print(f'\nfetched {n} file(s); raw/ is ready')
