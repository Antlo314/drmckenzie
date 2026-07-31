"""Generate the sub-pages from one shared shell.

Output is plain static HTML — the site still serves with no build step. This
script exists so the header, footer, and nav do not drift across nine files.
Slugs mirror the live Wix URLs exactly (/booking, /plans-pricing, /shop, ...)
so existing links and bookmarks keep resolving after a cutover.

MONEY RULE: anything that takes a payment stays on Wix. Product buttons go to
the real /product-page/<slug>, plans to /plans-pricing, donations to /missions
(the PayPal widget is client-rendered there and has no reproducible endpoint),
bookings to /booking. Never invent a checkout target.
"""
import json, os, html

HERE = os.path.dirname(__file__)
SITE = os.path.join(HERE, '..', 'site')
WIX = 'https://www.kemberlymckenzie.com'

NAV = [
    ('/', 'Home'), ('/about-1/', 'Books'), ('/mind-your-mind/', 'Mind Your Mind'),
    ('/plans-pricing/', 'Coaching'), ('/shop/', 'Shop'),
    ('/consulting/', 'Consulting'), ('/missions/', 'Missions'), ('/booking/', 'Booking'),
]


def shell(slug, title, desc, theme, body, og='/assets/img/portrait-full.webp'):
    nav = '\n    '.join(
        f'<a href="{h}"{" class="+chr(34)+"active"+chr(34) if h.rstrip("/") == "/" + slug else ""}>{t}</a>'
        for h, t in NAV)
    mob = ''.join(f'<a href="{h}">{t}</a>' for h, t in NAV)
    return f'''<!DOCTYPE html>
<html lang="en" class="no-js" data-theme="{theme}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{html.escape(title)} | Dr. Kemberly E. McKenzie</title>
<meta name="description" content="{html.escape(desc)}">
<meta property="og:title" content="{html.escape(title)} — Dr. Kem">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:image" content="{og}">
<link rel="icon" href="/assets/logo/lockup.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..800;1,6..96,400..800&family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Outfit:wght@200..800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/main.css">
</head>
<body>

<canvas id="gl" aria-hidden="true"></canvas>
<div class="grain" aria-hidden="true"></div>

<header class="site-head" id="top">
  <a class="brand" href="/" aria-label="Mind Your Mind — Dr. Kem, home">
    <span class="lockup lockup--head" aria-hidden="true">
      <i class="lk lk-mind"></i><i class="lk lk-your"></i><i class="lk lk-mind2"></i><i class="lk lk-kem"></i>
    </span>
    <span class="brand-name">DR. KEMBERLY E. MCKENZIE</span>
  </a>
  <nav class="nav" aria-label="Primary">
    {nav}
  </nav>
  <a class="btn btn--small btn--solid head-cta" href="/booking/">Book Dr. Kem</a>
  <button class="menu-btn" aria-label="Open menu" aria-expanded="false"><span></span><span></span></button>
</header>

<div class="mobile-nav" hidden>
  {mob}
  <a class="btn btn--solid" href="/booking/">Book Dr. Kem</a>
</div>

<main>
{body}
</main>

<footer class="site-foot">
  <div class="wrap foot-inner">
    <p>© 2026 KEM Consulting Group, LLC · <span class="foot-motto">Keep Everything Moving.</span></p>
    <nav class="foot-links" aria-label="Site pages">
      <a href="/plans-pricing/">Plans &amp; Pricing</a>
      <a href="/booking/">Booking</a>
      <a href="/application/">Forms</a>
      <a href="/missions/">Donate</a>
      <a href="/shop/">Shop</a>
    </nav>
    <p class="foot-credit">Crafted by Lumen Labs ATL</p>
  </div>
</footer>

<script src="/js/gl.js"></script>
<script src="/js/main.js"></script>
</body>
</html>
'''


def hero(kicker, title, lede, center=False, label=None):
    # the crumb takes an explicit label — title-casing the kicker mangles
    # things like LLC and K.E.M.
    c = ' center' if center else ''
    return f'''<section class="page-hero{c}" data-theme-section="{{theme}}">
  <div class="wrap">
    <p class="crumb"><a href="/">Home</a> · {label or kicker.title()}</p>
    <p class="kicker" data-reveal>{kicker}</p>
    <h1 class="h-serif" data-reveal>{title}</h1>
    <p class="lede" data-reveal>{lede}</p>
  </div>
</section>'''


HANDOFF = ('<div class="handoff" data-reveal><span aria-hidden="true">🔒</span>'
           '<p><strong>Secure checkout.</strong> {what} is handled on the existing '
           'kemberlymckenzie.com store, so your order and payment details go through '
           'the same system as always.</p></div>')

pages = {}

# ---------------------------------------------------------------- SHOP
prods = json.load(open(os.path.join(HERE, 'wix', 'products.json')))
order = ['night-vision-how-to-see-your-way-though-any-situation', 'night-vision-the-journal',
         'night-vision-book-journal', 'k-e-m-book', 'k-e-m-study-guide-journal',
         'k-e-m-book-journal', 'mind-your-manuscript', 'mind-your-mindtee',
         'kem-tee-black', 'kem-tee-white', 'thankful-tee', 'grateful-tee-peach',
         'grateful-tee-yellow', 'kem-hoodie-black', 'kem-hoodie-white',
         'thankful-hoodie', 'grateful-hoodie-peach', 'grateful-hoodie-yellow']
by_slug = {p['slug']: p for p in prods}
cards = []
for slug in order:
    p = by_slug[slug]
    name = html.unescape(p['name'])
    price = p['price']
    price = f'${price}' if '.' in price else f'${price}.00'
    cards.append(f'''      <a class="product{' product--cover' if p['cover'] else ''}" href="{WIX}/product-page/{slug}" target="_blank" rel="noopener" data-reveal>
        <img src="/{p['web']}" alt="{html.escape(name)}" loading="lazy">
        <span class="product-foot">
          <span class="product-name">{html.escape(name)}</span>
          <span class="product-price">{price}</span>
          <span class="product-cta">BUY NOW →</span>
        </span>
      </a>''')
pages['shop'] = dict(
    title='Shop', theme='shop',
    desc='Books, journals, tees and hoodies from Dr. Kemberly E. McKenzie — Night Vision, K.E.M., and Mind Your Mind.',
    body=hero('THE SHOP', 'Wear the <em>message</em>.',
              'Every book, journal, tee and hoodie from Dr. Kem — including the Amazon best-seller <em>Night Vision</em> and the Mind Your Mind collection.',
              center=True, label='Shop') + f'''
<section class="sec" data-theme-section="shop" style="padding-top:0">
  <div class="wrap">
    {HANDOFF.format(what='Checkout')}
    <div class="rule"></div>
    <div class="catalog">
{chr(10).join(cards)}
    </div>
  </div>
</section>''')

# ------------------------------------------------------- PLANS & PRICING
PLANS = [
    ('Bronze-G', '300', 'Group cohort · 10 people max', '3 months',
     ['9 group sessions', '3 individual sessions', 'Option to add 3–6 more months'], '$1,000', False),
    ('Bronze-I', '333.33', 'Individual coaching', '3 months',
     ['3 months of individual concentration', 'Total of 9 sessions'], '$1,000', True),
    ('Silver-G', '283.33', 'Group coaching', '6 months',
     ['12 group sessions', '6 individual sessions'], '$1,600', False),
    ('Silver-I', '316.67', 'Individual coaching', '6 months',
     ['6 months of individual coaching', 'Total of 21 sessions'], '$1,900', False),
    ('Gold-G', '277.78', 'Group coaching', '9 months',
     ['27 group coaching sessions', '9 individual sessions'], '$2,500', False),
    ('Gold-I', '311.11', 'Individual coaching', '9 months',
     ['9 months of individual coaching', 'Total of 27 sessions'], '$2,800', False),
    ('Platinum-G', '250', 'Group coaching', '12 months',
     ['36 group coaching sessions', '12 individual sessions'], '$3,000', False),
    ('Platinum-I', '300', 'Individual coaching', '12 months',
     ['12 months of individual coaching', 'Total of 44 sessions'], '$3,600', False),
]
plan_cards = []
for name, rate, sub, term, feats, total, best in PLANS:
    lis = ''.join(f'<li>{f}</li>' for f in feats)
    plan_cards.append(f'''      <article class="plan{' plan--best' if best else ''}" data-reveal>
        <p class="plan-term">{term.upper()}</p>
        <h3>{name} Package</h3>
        <p class="plan-rate"><strong>${rate}</strong><span>/ month</span></p>
        <p style="color:var(--muted);font-size:14px">{sub}</p>
        <ul>{lis}</ul>
        <p class="plan-total">Total package: {total}</p>
        <a class="btn {'btn--solid' if best else 'btn--line'}" href="{WIX}/plans-pricing" target="_blank" rel="noopener">Select Plan</a>
      </article>''')
pages['plans-pricing'] = dict(
    title='Plans & Pricing', theme='coaching',
    desc='Choose your KEM Coaching plan — group or individual, 3 to 12 months. Every package requires a $100 deposit applied to your first month.',
    body=hero('CHOOSE YOUR COACHING PLAN', 'Reserve your spot <em>today</em>.',
              'Group or individual, three months to a full year. Wondering which fits? Book a free 10-minute consultation first — it is on the house.',
              center=True, label='Plans & Pricing') + f'''
<section class="sec" data-theme-section="coaching" style="padding-top:0">
  <div class="wrap">
    <div class="cta-row center" data-reveal>
      <a class="btn btn--ghost" href="https://calendly.com/kemcoaching/coaching-phone-consult" target="_blank" rel="noopener">Book a free consultation</a>
    </div>
    <div class="rule"></div>
    <div class="plan-grid">
{chr(10).join(plan_cards)}
    </div>
    <div class="rule"></div>
    <div class="cards">
      <article class="card" data-reveal>
        <span class="card-num">✦</span>
        <h3>Strategy Session</h3>
        <p class="card-tag">INDIVIDUALLY FOCUSED</p>
        <p>Book up to three hours of personal mentorship and decision-making support with Dr. Kem.</p>
        <p class="price"><strong>$375</strong><span> per session</span></p>
        <a class="btn btn--line" href="{WIX}/plans-pricing" target="_blank" rel="noopener">Book a Session</a>
      </article>
      <article class="card" data-reveal>
        <span class="card-num">✦</span>
        <h3>Coaching Deposit</h3>
        <p class="card-tag">REQUIRED FOR ALL PACKAGES</p>
        <p>Every package requires a $100 deposit, valid for one month. Deposits are applied toward your first month.</p>
        <p class="price"><strong>$100</strong><span> deposit</span></p>
        <a class="btn btn--line" href="{WIX}/plans-pricing" target="_blank" rel="noopener">Pay Deposit</a>
      </article>
      <article class="card" data-reveal>
        <span class="card-num">✦</span>
        <h3>Still deciding?</h3>
        <p class="card-tag">FREE CONSULTATION</p>
        <p>Ten complimentary minutes with Dr. KEM to talk through which program aligns with your goals.</p>
        <p class="price"><strong>Free</strong><span> · 10 minutes</span></p>
        <a class="btn btn--solid" href="https://calendly.com/kemcoaching/coaching-phone-consult" target="_blank" rel="noopener">Book the Call</a>
      </article>
    </div>
    <div class="rule"></div>
    <blockquote class="motto" data-reveal style="max-width:64ch">“I am honored that you have chosen me to coach you along your new journey. I am elated about our partnership and your quest for Knowledge, Empowerment, and Motivation. You will never be the same — let me be the first to welcome you to your new self.” <br><span style="font-family:var(--font-sans);font-size:13px;letter-spacing:.16em;font-style:normal">— DR. KEM</span></blockquote>
    {HANDOFF.format(what='Plan enrollment and payment')}
  </div>
</section>''')

# ------------------------------------------------------------- BOOKING
pages['booking'] = dict(
    title='Booking', theme='connect',
    desc='Book Dr. Kemberly E. McKenzie as your next speaker — leadership development, team building, staff and professional development.',
    body=hero('BOOK DR. KEM', 'Book Dr. Kem as your <em>next speaker</em>.',
              'Over 25 years in education and leadership development, delivered to teams, congregations, agencies and conferences.', label='Booking') + f'''
<section class="sec" data-theme-section="connect" style="padding-top:0">
  <div class="wrap cols">
    <figure class="about-photo" data-reveal>
      <div class="photo-frame"><img src="/assets/img/portrait-thankful.webp" alt="Dr. Kemberly E. McKenzie" loading="lazy"></div>
    </figure>
    <div class="prose" data-reveal>
      <h3>Credentials</h3>
      <p>Dr. McKenzie holds a Bachelor's degree in Speech Communication and three Master's degrees — Elementary Education, Special Education, and Educational Leadership — plus a doctorate in Educational Leadership. She is currently pursuing a Master's in Clinical Mental Health, and studied abroad at both Cambridge and Oxford.</p>
      <h3>Experience</h3>
      <p>Extensive experience in Education, Leadership Development, Team Building, and Staff and Professional Development, with over 25 years of service as an educator across Philadelphia, Chicago, and the Atlanta Metro area.</p>
      <h3>Certifications</h3>
      <ul>
        <li>Behavior Specialist</li>
        <li>Anger Management Specialist</li>
        <li>Special Educator</li>
        <li>True Colors Facilitator</li>
        <li>Certified Professional Development Life Coach</li>
      </ul>
      <h3>Ministry &amp; travel</h3>
      <p>Dr. McKenzie has travelled the world spreading the Gospel, clothing and feeding children and families in need — Barcelona, Paris, Rome, London, the Dominican Republic, and Cape Town, South Africa among them.</p>
      <p>She is the author of <a href="/about-1/">K.E.M. (Keep Everything Moving): Letting Adversity Guide You to Destiny</a> and Amazon's best seller, <a href="/about-1/">Night Vision: How to See Your Way Through Any Situation</a>.</p>
      <blockquote class="motto">“If I can help somebody as I travel along life's way, then my living will not be in vain.”</blockquote>
      <p style="letter-spacing:.14em;font-size:13px">HER MANTRA — <strong>K.E.M. (KEEP EVERYTHING MOVING)</strong></p>
      <div class="cta-row">
        <a class="btn btn--solid" href="{WIX}/booking" target="_blank" rel="noopener">Request a Booking</a>
        <a class="btn btn--ghost" href="mailto:KeepEverythingMoving@gmail.com?subject=Speaking%20request%20for%20Dr.%20Kem">Email the Office</a>
      </div>
      <p style="margin-top:18px;font-size:14px;color:var(--muted)">Please include event details — date, time, type of event, and audience.</p>
    </div>
  </div>
</section>''')

# ------------------------------------------------------------ MISSIONS
pages['missions'] = dict(
    title='Donate to Missions', theme='missions',
    desc='Support the Cape Town, South Africa missions — groceries, youth camps, clothing, shoes and warm meals for underserved families.',
    body=hero('MISSIONS · CAPE TOWN, SOUTH AFRICA', 'Help a child — or a family — <em>smile</em>.',
              'Dr. McKenzie leads multiple missions teams alongside Pastor Stephanie Jennings of the Harvest Tabernacle, serving the Cape Town community.',
              center=True, label='Missions') + f'''
<section class="sec" data-theme-section="missions" style="padding-top:0">
  <div class="wrap narrow">
    <div class="prose center" style="margin-inline:auto" data-reveal>
      <h3>What the missions do</h3>
      <ul style="text-align:left;display:inline-grid">
        <li>Distributing groceries to underserved families in their homes</li>
        <li>Facilitating children's and youth camps</li>
        <li>Providing clothing and shoes for adults and children — including 250+ coats in a single drive</li>
        <li>Providing warm meals for families</li>
        <li>Personal and professional training for adults</li>
      </ul>
    </div>
    <div class="cta-row center" data-reveal>
      <a class="btn btn--solid" href="{WIX}/missions" target="_blank" rel="noopener">Donate with PayPal</a>
      <a class="btn btn--ghost" href="/about-5/">Join the 2027 Retreat</a>
    </div>
    <div class="rule"></div>
    <div class="handoff" style="margin-inline:auto" data-reveal><span aria-hidden="true">🔒</span>
      <p><strong>Donations run through PayPal</strong> on the existing kemberlymckenzie.com missions page, so your gift reaches the same account it always has.</p></div>
  </div>
</section>''')

# ---------------------------------------------------------- CONSULTING
TRAININGS = ['Anger Management Skills', 'Conflict Resolution / Problem-solving', 'Decision Making',
             'Diversity / Cultural Awareness', 'Effective Communication Styles', 'Leadership Skills',
             'Learning Styles', 'Stress Management', 'Time Management']
SERVICES = ['Budget Planning', 'Motivational Speaking', 'Personal and Professional Development',
            'Staff Orientation', 'Strategic Planning', 'Team Building', 'True Colors Workshop']
pages['consulting'] = dict(
    title='Consulting', theme='shop',
    desc='KEM Consulting Group LLC — comprehensive business solutions for individuals, businesses, government agencies and non-profits.',
    body=hero('KEM CONSULTING GROUP, LLC', 'Keeping everything <em>moving</em>.',
              'A comprehensive business solutions company providing individuals, businesses, government agencies and non-profit organizations with strategies to enhance workplace relationships.', label='Consulting') + f'''
<section class="sec" data-theme-section="shop" style="padding-top:0">
  <div class="wrap">
    <div class="two-list">
      <div data-reveal>
        <p class="kicker">TRAININGS</p>
        <ul class="svc-list">{''.join(f'<li>{t}</li>' for t in TRAININGS)}</ul>
      </div>
      <div data-reveal>
        <p class="kicker">SERVICES</p>
        <ul class="svc-list">{''.join(f'<li>{s}</li>' for s in SERVICES)}</ul>
      </div>
    </div>
    <div class="rule"></div>
    <div class="cta-row" data-reveal>
      <a class="btn btn--solid" href="{WIX}/consulting" target="_blank" rel="noopener">Get Started</a>
      <a class="btn btn--ghost" href="mailto:KeepEverythingMoving@gmail.com?subject=KEM%20Consulting%20enquiry">Email the Office</a>
    </div>
  </div>
</section>''')

# --------------------------------------------------------------- BOOKS
pages['about-1'] = dict(
    title='Books', theme='night',
    desc='Night Vision: How to See Your Way Through Any Situation, and K.E.M. (Keep Everything Moving) by Dr. Kemberly E. McKenzie.',
    og='/assets/img/mock-bookstack.webp',
    body=hero('FROM THE DESK OF DR. KEM', 'You need <em>Night Vision</em>.',
              'Two books written to be read in the dark — and a study guide journal to work through them.',
              center=True, label='Books') + f'''
<section class="sec" data-theme-section="night" style="padding-top:0">
  <div class="wrap cols night-cols">
    <figure class="night-photo" data-reveal>
      <img src="/assets/img/mock-bookstack.webp" alt="Night Vision paperback stack" loading="lazy">
    </figure>
    <div class="prose" data-reveal>
      <h3 style="margin-top:0">Night Vision <span class="amazon-badge">AMAZON BEST SELLER</span></h3>
      <p class="book-sub"><em>How to See Your Way Through Any Situation</em></p>
      <p>I'm Dr. Kem, and I am excited about my book written especially for you, for this specific moment. You would be surprised to know it had been written for a while — but God burdened me to release it NOW.</p>
      <p>Though current circumstances may seem dark, chaotic or blurred, you WILL see your way through. We must be willing to change our perspective on the way we view our “unpleasant” situations — or current darkness, if you will.</p>
      <p>Through an unexpected and traumatic night of being lost in the woods, Dr. McKenzie emerged with twenty-one life-altering revelations that will change anyone's perspective about seemingly destitute situations. Let NIGHT VISION serve as <strong>your compass</strong> through the dark moments life may set before you.</p>
      <h3>K.E.M. — Keep Everything Moving</h3>
      <p class="book-sub"><em>Letting Adversity Guide You To Destiny</em></p>
      <p>In K.E.M., Dr. McKenzie shares her story in the belief that others will be encouraged to celebrate adversity on their way to destiny. Coupled with the Study Guide Journal — designed to let you delve into each chapter a little further — you can stop, look at your life, and derive a plan to face adverse situations.</p>
      <div class="cta-row">
        <a class="btn btn--solid" href="/shop/">Get the Books</a>
        <a class="btn btn--ghost" href="{WIX}/product-page/night-vision-book-journal" target="_blank" rel="noopener">Book &amp; Journal Bundle · $25.99</a>
      </div>
    </div>
  </div>
</section>''')

# ------------------------------------------------------------- RETREAT
pages['about-5'] = dict(
    title='Mind Your Mind Dream Bigger 2027', theme='mym',
    desc='The Mind Your Mind Dream Bigger South African Experience 2027 — a ten-day retreat in Cape Town. Empowerment, Expansion, Elevation.',
    og='/assets/img/mym-drkem-green.webp',
    body=hero('EMPOWERMENT ✦ EXPANSION ✦ ELEVATION', 'Dream Bigger — <em>Cape Town</em>, 2027.',
              'Mind Your Mind is going global, and this is your invitation to a true mind makeover.', label='Dream Bigger 2027') + f'''
<section class="sec" data-theme-section="mym" style="padding-top:0">
  <div class="wrap cols cols--rev">
    <div class="prose" data-reveal>
      <p>Hosted in Cape Town, South Africa, this retreat creates space for mental renewal, expands your perspective, and equips you to return home with clarity that changes everything. Join Dr. Kemberly E. McKenzie — your Mind Doctor and Mental Strategist — for an immersive global experience curated with your mind in mind.</p>
      <h3>What it does</h3>
      <ul>
        <li>Break out of survival thinking</li>
        <li>Interrupt negative mental cycles</li>
        <li>Expand beyond familiar environments</li>
        <li>Gain clarity about purpose and next steps</li>
        <li>Build confidence and courage</li>
        <li>Experience sisterhood and global exposure</li>
        <li>Return home transformed — internally and externally</li>
      </ul>
      <h3>Who it's for</h3>
      <ul>
        <li>Mental health professionals</li>
        <li>Those living with mental health challenges</li>
        <li>Caregivers supporting them</li>
        <li>Members of faith-based communities</li>
      </ul>
    </div>
    <figure class="mym-photo" data-reveal>
      <img src="/assets/img/mym-drkem-green.webp" alt="Dr. Kem at the Mind Your Mind Summit" loading="lazy">
    </figure>
  </div>
  <div class="wrap">
    <div class="rule"></div>
    <div class="mym-grid">
      <article class="event-card" data-reveal>
        <p class="event-when">THE TRIP</p>
        <h3>Ten days in <span class="year">Cape Town</span></h3>
        <p>General sessions, breakout sessions, round tables, entertainment, and a Q&amp;A for attendees. Departure from Atlanta, GA and return to Atlanta.</p>
      </article>
      <article class="event-card event-card--gold" data-reveal>
        <p class="event-when">WHAT'S INCLUDED</p>
        <h3>Your <span class="year">$5,500</span> investment</h3>
        <p>Roundtrip airfare from Atlanta · private ground transportation · cultural exploration experiences · cultural dining and entertainment · two pieces of official retreat apparel.</p>
      </article>
      <article class="event-card" data-reveal>
        <p class="event-when">TO RESERVE</p>
        <h3>A <span class="year">$250</span> deposit</h3>
        <p>A $250 deposit holds your place. Apply through the form and the office will follow up with the full itinerary.</p>
        <a class="btn btn--solid" href="/application/">Apply Now</a>
      </article>
    </div>
    <div class="rule"></div>
    <div class="cta-row" data-reveal>
      <a class="btn btn--solid" href="{WIX}/event-details/mymdreambigger2027" target="_blank" rel="noopener">Buy Tickets</a>
      <a class="btn btn--ghost" href="/mind-your-mind/">See All Events</a>
    </div>
  </div>
</section>''')

# ------------------------------------------------------- MIND YOUR MIND
pages['mind-your-mind'] = dict(
    title='Mind Your Mind', theme='mym',
    desc='Mind Your Mind events and replays — the Cape Town 2027 experience, Mind Your Mind 2025, MYM 2.0, and the virtual replay.',
    body=hero('THE MIND YOUR MIND EXPERIENCE', 'Events &amp; <em>replays</em>.',
              'A weekend of mental and physical healing and conditioning — empowering your mind, nurturing your spirit, strengthening your health.', label='Mind Your Mind') + f'''
<section class="sec" data-theme-section="mym" style="padding-top:0">
  <div class="wrap">
    <p class="kicker" data-reveal>UPCOMING</p>
    <div class="event-row" data-reveal>
      <div><p class="when">SAT, FEB 13 · 2027</p></div>
      <div>
        <h3>MYM Dream Bigger — Cape Town, South Africa</h3>
        <p>The Colosseum Luxury Hotel. Cape Town is calling. A life-shifting retreat designed to reset your mind, renew your spirit, and realign your purpose.</p>
      </div>
      <a class="btn btn--solid" href="{WIX}/event-details/mymdreambigger2027" target="_blank" rel="noopener">Buy Tickets</a>
    </div>
    <div class="event-row" data-reveal>
      <div><p class="when">FRI 10/10 6:30–10:30 PM · SAT 10/11 9 AM–4 PM</p></div>
      <div>
        <h3>Mind Your Mind 2025</h3>
        <p>Atlanta Evergreen Lakeside Resort. A weekend of mental and physical healing and conditioning: “Empowering Your Mind. Nurturing Your Spirit. Strengthening Your Health.”</p>
      </div>
      <a class="btn btn--line" href="{WIX}/event-details/mind-your-mind-2025" target="_blank" rel="noopener">Details</a>
    </div>
    <div class="event-row" data-reveal>
      <div><p class="when">FRI 4/26 7 PM · SAT 4/27 9 AM</p></div>
      <div>
        <h3>Mind Your Mind 2.0 (MYM 2.0)</h3>
        <p>The Harvest Tabernacle Church. Back by popular demand — Mind Your Mind 2.0 will transform your thinking to another level.</p>
      </div>
      <a class="btn btn--line" href="{WIX}/event-details/mind-your-mind-2-0-mym-2-0" target="_blank" rel="noopener">Details</a>
    </div>
    <div class="rule"></div>
    <div class="cols">
      <div data-reveal>
        <p class="kicker">THE REPLAY</p>
        <h2 class="h-serif">Missed it? <em>Watch it back.</em></h2>
        <p style="color:var(--muted)">A full day of mental healing and conditioning with Dr. Kemberly Elaine McKenzie and experienced facilitators — 9 AM to 5 PM, streamed on YouTube.</p>
        <p class="plan-total" style="margin-top:14px">Virtual experience · $50</p>
        <div class="cta-row">
          <a class="btn btn--solid" href="{WIX}/mind-your-mind" target="_blank" rel="noopener">Watch the Replay</a>
          <a class="btn btn--ghost" href="/shop/">Conference Tee</a>
        </div>
      </div>
      <figure class="about-photo" data-reveal>
        <div class="photo-frame"><img src="/assets/img/shop/cut-19a5ab5bb557.webp" alt="Mind Your Mind conference tee" loading="lazy" style="background:transparent"></div>
      </figure>
    </div>
  </div>
</section>''')

# ----------------------------------------------------------- APPLICATION
pages['application'] = dict(
    title='Forms', theme='connect',
    desc='Coaching application and retreat forms for KEM Coaching and the Mind Your Mind experience.',
    body=hero('FORMS', 'Start your <em>application</em>.',
              'Applications for coaching and for the Mind Your Mind retreat are handled on the existing site so your submission reaches the office the same way it always has.',
              center=True, label='Forms') + f'''
<section class="sec" data-theme-section="connect" style="padding-top:0">
  <div class="wrap narrow">
    <div class="cards">
      <article class="card" data-reveal>
        <span class="card-num">01</span>
        <h3>Coaching Application</h3>
        <p>Tell Dr. Kem about your goals and which package you're considering.</p>
        <a class="btn btn--solid" href="{WIX}/application" target="_blank" rel="noopener">Open the Form</a>
      </article>
      <article class="card" data-reveal>
        <span class="card-num">02</span>
        <h3>Retreat Application</h3>
        <p>Apply for the Mind Your Mind Dream Bigger Cape Town experience. A $250 deposit reserves your place.</p>
        <a class="btn btn--line" href="{WIX}/application" target="_blank" rel="noopener">Open the Form</a>
      </article>
      <article class="card" data-reveal>
        <span class="card-num">03</span>
        <h3>Speaking Request</h3>
        <p>Booking Dr. Kem for an event? Send the date, time, type of event and audience.</p>
        <a class="btn btn--line" href="/booking/">Booking Details</a>
      </article>
    </div>
    <div class="rule"></div>
    <div class="handoff" data-reveal><span aria-hidden="true">✉</span>
      <p><strong>Prefer email?</strong> Write to <a href="mailto:KeepEverythingMoving@gmail.com">KeepEverythingMoving@gmail.com</a> or call the office on <a href="tel:+16784698879">(678) 469-8879</a>.</p></div>
  </div>
</section>''')

# ------------------------------------------------------------------ write
for slug, p in pages.items():
    body = p['body'].replace('{theme}', p['theme'])
    out_dir = os.path.join(SITE, slug)
    os.makedirs(out_dir, exist_ok=True)
    doc = shell(slug, p['title'], p['desc'], p['theme'], body, p.get('og', '/assets/img/portrait-full.webp'))
    with open(os.path.join(out_dir, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(doc)
    print(f'{slug:<18} {len(doc):>7} bytes')
print(f'\n{len(pages)} pages written')
