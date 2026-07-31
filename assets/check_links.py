"""Crawl every page in site/ and verify each link resolves.

Internal links must map to a real file on disk; external links must answer 200.
Run after build_pages.py. Exits non-zero if anything is broken.
"""
import os, re, sys, time, urllib.request, urllib.error

# preconnect/dns-prefetch point at an origin, not a document — a 404 there is
# expected and meaningless
SKIP_ORIGINS = {'https://fonts.googleapis.com', 'https://fonts.gstatic.com'}

HERE = os.path.dirname(__file__)
SITE = os.path.abspath(os.path.join(HERE, '..', 'site'))

pages = []
for root, _dirs, files in os.walk(SITE):
    for f in files:
        if f.endswith('.html'):
            pages.append(os.path.join(root, f))

internal_bad, external = [], {}
asset_bad = []

for page in sorted(pages):
    rel = os.path.relpath(page, SITE).replace('\\', '/')
    s = open(page, encoding='utf-8').read()
    for m in re.finditer(r'(?:href|src)="([^"#][^"]*)"', s):
        url = m.group(1)
        if url.startswith(('mailto:', 'tel:', 'data:')):
            continue
        if url.startswith('http'):
            external.setdefault(url, []).append(rel)
            continue
        target = url.split('?')[0].split('#')[0]
        path = os.path.join(SITE, target.lstrip('/')) if target.startswith('/') \
            else os.path.join(os.path.dirname(page), target)
        if os.path.isdir(path):
            path = os.path.join(path, 'index.html')
        if not os.path.exists(path):
            (asset_bad if re.search(r'\.(webp|png|jpg|jpeg|css|js|json)$', target) else internal_bad).append((rel, url))

print(f'crawled {len(pages)} pages\n')

print('INTERNAL')
if internal_bad or asset_bad:
    for where, url in internal_bad + asset_bad:
        print(f'  BROKEN  {where} -> {url}')
else:
    print('  all internal links and assets resolve')

print('\nEXTERNAL')


def fetch(url, method):
    req = urllib.request.Request(url, method=method,
                                 headers={'User-Agent': 'Mozilla/5.0 (link-check)'})
    return urllib.request.urlopen(req, timeout=25).status


fails = []
for url in sorted(external):
    if url in SKIP_ORIGINS:
        print(f'  skip  {url}  (preconnect origin)')
        continue
    code = None
    for attempt in range(4):
        try:
            # some hosts reject HEAD outright, so fall back to GET
            code = fetch(url, 'HEAD')
        except urllib.error.HTTPError as e:
            code = e.code
            if code in (403, 405):
                try:
                    code = fetch(url, 'GET')
                except urllib.error.HTTPError as e2:
                    code = e2.code
                except Exception as e2:
                    code = type(e2).__name__
        except Exception as e:
            code = type(e).__name__
        if code == 429:            # Wix throttles a fast crawl; back off
            time.sleep(4 * (attempt + 1))
            continue
        break
    # 429 = Wix throttling a fast crawl, 999 = LinkedIn's bot block. Neither
    # means the link is broken; both were confirmed 200 by spaced-out GETs.
    if code in (429, 999):
        print(f'  {code}  {url}  (throttled/bot-blocked, not broken)')
    else:
        if code != 200:
            fails.append((url, code))
        print(f'  {code}  {url}')
    time.sleep(1.2)                # stay under the rate limit

print()
if internal_bad or asset_bad or fails:
    print(f'FAIL — {len(internal_bad + asset_bad)} internal, {len(fails)} external')
    sys.exit(1)
print('PASS — every link resolves')
