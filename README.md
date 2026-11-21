# Dr. Kem — Mind Your Mind

**Galaxy:** Dr. Kem · **Lead:** Dr. Kemberly E. McKenzie (KEM Consulting Group, LLC)
**Port:** 4980 (site) · **Status:** site rebuilt, not yet deployed

A rebuild of [kemberlymckenzie.com](https://www.kemberlymckenzie.com) — a single
WebGL-backed page replacing the Wix multi-page site. All copy, pricing, and
imagery come from the live site; nothing is invented.

```
START-DRKEM-SITE.bat        ->  http://127.0.0.1:4980
```

## Layout

## Pages

Ten pages, all on the same design system. Sub-page slugs mirror the live Wix
URLs exactly, so every existing link and bookmark still resolves after a
cutover.

| Path | Was | Content |
|------|-----|---------|
| `/` | home | hero, about, coaching, MYM, books, shop, missions, connect |
| `/shop/` | `/shop` | all 18 products with real prices and images |
| `/plans-pricing/` | same | 8 coaching plans, strategy session, deposit |
| `/booking/` | same | full speaker bio, credentials, certifications |
| `/about-1/` | same | Night Vision + K.E.M. |
| `/about-5/` | same | Dream Bigger Cape Town 2027 retreat |
| `/mind-your-mind/` | same | events and the replay |
| `/missions/` | same | Cape Town missions + donate |
| `/consulting/` | same | KEM Consulting trainings and services |
| `/application/` | same | coaching, retreat, and speaking forms |

### Money never leaves Wix

Every payment path hands off to the live site, so nothing about billing
changed and nothing needs re-testing:

- products → `kemberlymckenzie.com/product-page/<slug>` (real Wix Stores checkout)
- plans and deposits → `/plans-pricing` (Wix Pricing Plans)
- donations → `/missions` (the PayPal button is a client-rendered Wix widget;
  its merchant ID is not in the page source, so there is nothing to reproduce)
- event tickets → `/event-details/<slug>` (Wix Events)
- free consult → the real Calendly link

Pages that take money show a small "secure checkout" note so the hand-off
isn't a surprise. `assets/build_pages.py` carries this rule in its docstring —
**never invent a checkout target.**

Catalog data in `assets/wix/products.json` was scraped from the live product
pages (name, price, image, slug). Re-run `build_pages.py` after Dr. Kem
changes pricing; nothing syncs automatically.

```
DrKem/
  site/                     the deliverable - fully static, no build step
    index.html
    shop/ plans-pricing/ booking/ about-1/ about-5/
    mind-your-mind/ missions/ consulting/ application/
    css/main.css            design system; themes are CSS custom properties
    js/gl.js                WebGL2 aurora shader + per-section palettes
    js/main.js              scroll orchestration, reveals, nav, countdown
    assets/logo/            recolorable wordmark masks + layout.json
    assets/img/             web-ready WebP (cutouts and covers)
  assets/                   source pipeline - not served
    raw/                    36 originals pulled from the Wix CDN
    extract_logo.py         wordmark -> per-word alpha masks
    process_assets.py       cutouts, crops, compression, script "Kem"
    cut_products.py         apparel off white backdrops
                            run order: extract_logo, process_assets, cut_products
                            (the last overwrites three flat shop images)
    cut_catalog.py          the 18 shop products: apparel cut, covers left flat
    build_pages.py          generates the nine sub-pages from one shared shell
    check_links.py          crawls every page; internal must resolve, external must 200
    wix/                    scraped source pages + products.json catalog
    key_green.py            notes on the summit-portrait key (see below)
    proof_*.png             visual checks for every matte
  shots.sh                  headless section screenshots
```

## Brand system

The "Mind Your Mind" lockup is **not an image drop-in**. Each word was unmixed
out of the 2000px Cape Town flyer into its own white+alpha PNG, so the site can
recolor it per section through CSS `mask-image` + a gradient background. The
brush-script "Kem" was lifted from the hero banner the same way and signs
beneath the wordmark (`.lockup--sign`).

## Light editorial system

The page runs on warm paper, not a dark field — reference points were
motionsites.ai and awwwards winners: off-white stock, oversized display serif,
hairline rules, white card surfaces with soft shadows, colour as accent rather
than as background. The WebGL layer washes the paper like ink bleeding into a
sheet instead of glowing out of a void, at low enough weight that type keeps
its contrast.

Seven themes drive both the CSS variables and the shader palette, switching as
the visitor scrolls. Each tints the *same* paper so the page reads as one
continuous surface:

| Section | Palette |
|---------|---------|
| hero | warm paper · teal + aubergine wordmark, gold signature |
| about / coaching | blush paper · magenta + gold |
| mind your mind | mint paper · deep green |
| books | **deep navy** — a deliberate inversion, see below |
| shop | sage paper · forest green |
| missions | sand paper · terracotta + rose |
| connect | lilac paper · purple + teal, back to the top |

**Night Vision stays dark on purpose.** That section is about seeing your way
through darkness, so it inverts to a deep navy band with the starfield on — an
editorial beat rather than a leftover from the previous dark build. Flip
`html[data-theme="night"]` in `css/main.css` and the `night` entry in
`js/gl.js` to make it light too.

There is no horizontal marquee band; it was removed at the client's request.

## Matte notes

Every cutout was proofed at pixel zoom against a dark field — see `assets/proof_*.png`.

- **Apparel** (`cut_products.py`): white backdrop unmixed for true partial alpha;
  background removal restricted to regions touching the frame so white print on
  the garments survives; rim highlight despilled with a grey erosion so no white
  fringe shows against the dark sections.
- **Summit portrait** (`key_green.py`): chroma key **abandoned on purpose**. The
  banner green and the shadowed creases of her mint dress are within ~30 of each
  other, so every threshold that removes the background punches holes in the
  dress. It ships as a deliberate brand-green panel with a feathered edge.
  Revisit only with a matte source or a segmentation model.

## Still open

- Not deployed. The live site remains Wix; this is a local rebuild.
- Forms are `mailto:` / outbound links to the Wix pages — no backend yet.
- Not registered in the Command deck (no engine, site only).
- Retreat countdown targets 2026-12-20; update or remove after departure.

## Site admin on Vercel

Deploy with the repository root as the Vercel Root Directory and keep
`site` as the output directory. The public pages remain static and
`api/site-content.js` runs as a Vercel Function.

Set these Vercel environment variables before using `/admin`:

- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from an Upstash Redis database. Use a separate database for preview deployments if they should publish independently.
- `DRKEM_ADMIN_PASSWORD`, a strong unique password shared privately with Dr. McKenzie.
- `DRKEM_SESSION_SECRET`, a separate random secret generated with `openssl rand -hex 32`.

Redeploy after setting the variables. Sign in at `/admin`, edit events or
appearance, and select **Publish changes**. Unchecked events are saved for
later and are visible only in admin. Upcoming published events appear on the
homepage, and `/events` lists upcoming and past published events. The
announcement is optional. Choosing **Original** restores the original palette.
Changes go straight to the site and do not require another deploy.

The paid add-on entries are placeholders for billing and feature integrations.
