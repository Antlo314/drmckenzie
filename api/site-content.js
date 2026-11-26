const { randomUUID } = require('node:crypto');
const {
  redis, equal, passwordKey, storedPassword, hashPassword, checkPassword, setupToken,
  signedIn, sessionCookie, newSession, storageConfigured, adminConfigured,
} = require('./_lib/store');

const contentKey = 'drkem:site-content:v1';
const imagesKey = 'drkem:images';            // hash: image id -> upload time (ms)
const imageKey = id => 'drkem:img:' + id;

// Editable photo slots. Each matches an <img data-photo="..."> on the site.
const photoSlots = ['home-about', 'home-mym', 'home-night', 'counseling', 'booking'];
const linkKeys = ['consult', 'coachingCall', 'paypal', 'donate'];
const socialKeys = ['instagram', 'facebook', 'tiktok', 'linkedin'];
const imageTypes = { 'image/webp': 'RIFF', 'image/jpeg': '\xff\xd8\xff', 'image/png': '\x89PNG' };
const maxImageBytes = 1_500_000;

// Blank strings mean "keep what the page already shows".
function blank() {
  return {
    revision: null, theme: 'green-blue', accent: '#17684e', secondary: '#195b86', announcement: '',
    events: [],
    contact: { email: '', phone: '' },
    social: Object.fromEntries(socialKeys.map(key => [key, ''])),
    links: Object.fromEntries(linkKeys.map(key => [key, ''])),
    photos: {},
    products: {},
  };
}

// Older saved content predates some sections; fill them in.
function normalize(stored) {
  const base = blank();
  if (!stored) return base;
  return {
    ...base, ...stored,
    events: (stored.events || []).map(event => ({ time: '', image: '', ...event })),
    contact: { ...base.contact, ...stored.contact },
    social: { ...base.social, ...stored.social },
    links: { ...base.links, ...stored.links },
    photos: { ...stored.photos },
    products: { ...stored.products },
  };
}

const uuid = value => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
const string = (value, length) => typeof value === 'string' && value.length <= length;
const color = value => string(value, 7) && /^#[a-f\d]{6}$/i.test(value);
const plainObject = value => !!value && typeof value === 'object' && !Array.isArray(value);

function httpsUrl(value, length = 500) {
  if (!string(value, length)) return false;
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01') return false;
  const parsed = new Date(value);
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === value;
}

function validate(content) {
  if (!plainObject(content) || !['original', 'green-blue', 'custom'].includes(content.theme) ||
      !color(content.accent) || !color(content.secondary) || !string(content.announcement, 240)) {
    return 'Check the colors and announcement.';
  }

  if (!Array.isArray(content.events) || content.events.length > 50) return 'Too many events (50 at most).';
  const ids = new Set();
  for (const event of content.events) {
    const name = event?.title ? `“${String(event.title).slice(0, 40)}”` : 'an event';
    if (!plainObject(event) || !uuid(event.id) || ids.has(event.id)) return 'An event could not be read. Reload and try again.';
    if (!string(event.title, 120) || !event.title.trim()) return 'Every event needs a title.';
    if (!date(event.date)) return `Add a date for ${name}.`;
    if (!string(event.time, 40) || !string(event.details, 900) || !string(event.location, 140)) return `Shorten the details for ${name}.`;
    if (typeof event.published !== 'boolean') return `Check “Show on site” for ${name}.`;
    if (!httpsUrl(event.url)) return `The link for ${name} must start with https://`;
    if (event.image !== '' && !uuid(event.image)) return `Re-upload the photo for ${name}.`;
    ids.add(event.id);
  }

  const { contact, social, links, photos, products } = content;
  if (!plainObject(contact) || !string(contact.email, 120) ||
      (contact.email && !/^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(contact.email))) return 'Check the email address.';
  if (!string(contact.phone, 25) || (contact.phone && !/^[\d\s()+.-]{7,25}$/.test(contact.phone))) return 'Check the phone number.';
  if (!plainObject(social) || !socialKeys.every(key => httpsUrl(social[key], 300))) return 'Social links must start with https://';
  if (!plainObject(links) || !linkKeys.every(key => httpsUrl(links[key]))) return 'Booking and payment links must start with https://';
  if (!plainObject(photos) || !Object.entries(photos).every(([slot, id]) => photoSlots.includes(slot) && uuid(id))) {
    return 'Re-upload the page photos.';
  }
  if (!plainObject(products) || Object.keys(products).length > 100) return 'Check the shop settings.';
  for (const [id, product] of Object.entries(products)) {
    if (!/^[a-z0-9-]{1,60}$/.test(id) || !plainObject(product) ||
        typeof product.hidden !== 'boolean' || typeof product.soldOut !== 'boolean' ||
        !string(product.price, 12) || (product.price && !/^\$?\d{1,5}(\.\d{2})?$/.test(product.price))) {
      return 'Shop prices should look like $25.00.';
    }
  }
  return '';
}

// Keep only known fields, so nothing unexpected is ever stored or served.
function clean(content) {
  const pick = (source, keys) => Object.fromEntries(keys.map(key => [key, source[key].trim()]));
  return {
    theme: content.theme, accent: content.accent, secondary: content.secondary,
    announcement: content.announcement.trim(),
    events: content.events.map(({ id, title, date, time, location, details, url, image, published }) =>
      ({ id, title: title.trim(), date, time: time.trim(), location: location.trim(), details: details.trim(), url: url.trim(), image, published })),
    contact: pick(content.contact, ['email', 'phone']),
    social: pick(content.social, socialKeys),
    links: pick(content.links, linkKeys),
    photos: { ...content.photos },
    products: Object.fromEntries(Object.entries(content.products)
      .map(([id, { price, hidden, soldOut }]) => [id, { price: price.trim(), hidden, soldOut }])
      .filter(([, product]) => product.price || product.hidden || product.soldOut)),
  };
}

async function readContent() {
  return normalize(JSON.parse(await redis('GET', contentKey) ?? 'null'));
}

// Delete uploaded photos that nothing uses any more. Uploads stay for a day
// first, so a photo added in an editor that has not been published yet survives.
async function pruneImages(content) {
  const used = new Set([...content.events.map(event => event.image), ...Object.values(content.photos)]);
  const entries = await redis('HGETALL', imagesKey) || [];
  const stale = [];
  for (let i = 0; i < entries.length; i += 2) {
    if (!used.has(entries[i]) && Date.now() - Number(entries[i + 1]) > 86_400_000) stale.push(entries[i]);
  }
  if (!stale.length) return;
  await redis('DEL', ...stale.map(imageKey));
  await redis('HDEL', imagesKey, ...stale);
}

async function upload(body) {
  const { type, data } = body;
  if (!(type in imageTypes) || typeof data !== 'string' || data.length > maxImageBytes * 1.4 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return null;
  const bytes = Buffer.from(data, 'base64');
  if (bytes.length > maxImageBytes || !bytes.toString('latin1', 0, imageTypes[type].length).startsWith(imageTypes[type])) return null;
  const id = randomUUID();
  await redis('SET', imageKey(id), JSON.stringify({ type, data }));
  await redis('HSET', imagesKey, id, String(Date.now()));
  return id;
}

module.exports = async (req, res) => {
  const admin = req.query?.admin === '1';
  const reply = (status, value) => res.status(status).json(value);
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      if (admin && !(await signedIn(req))) return reply(401, { error: 'Sign in to continue.' });
      if (admin && !storageConfigured()) return reply(503, { error: 'Site storage needs to be configured.' });
      const content = storageConfigured() ? await readContent() : blank();
      if (admin) return reply(200, content);
      // Visitors get a copy the CDN may keep for a few seconds.
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=15, stale-while-revalidate=60');
      const { revision, events, ...rest } = content;
      return reply(200, { ...rest, events: events.filter(event => event.published) });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return reply(405, { error: 'Method unavailable.' });
    }
    // Browser requests from other origins cannot send this header without a CORS preflight.
    if (req.headers['x-drkem-admin'] !== '1' || !plainObject(req.body)) {
      return reply(403, { error: 'Invalid admin request.' });
    }
    if (req.body.action === 'logout') {
      res.setHeader('Set-Cookie', sessionCookie('; Max-Age=0'));
      return reply(200, {});
    }
    if (!adminConfigured()) return reply(503, { error: 'Admin sign-in and storage need to be configured.' });

    const { action } = req.body;
    const password = req.body.password;
    const validPassword = typeof password === 'string' && password.length >= 10 && password.length <= 200;

    // Limit password guesses (sign-in, setup and password changes) per address.
    if (['login', 'setup', 'password'].includes(action)) {
      const ip = String(req.headers['x-real-ip'] || req.socket?.remoteAddress || '').slice(0, 80);
      const attempts = await redis('EVAL',
        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
        1, 'drkem:signin:' + ip);
      if (attempts > 12) return reply(429, { error: 'Too many attempts. Try again in a minute.' });
    }

    if (action === 'setup') {
      const { token } = req.body;
      if (typeof token !== 'string' || token.length > 100 || !equal(token, setupToken())) {
        return reply(403, { error: 'This setup link is not valid. Ask for a new one.' });
      }
      if (!validPassword) return reply(400, { error: 'Choose a password of at least 10 characters.' });
      const stored = await hashPassword(password);
      if (await redis('SET', passwordKey, stored, 'NX') !== 'OK') {
        return reply(409, { error: 'A password has already been set. Sign in with it instead.' });
      }
      res.setHeader('Set-Cookie', newSession(stored));
      return reply(200, {});
    }

    if (action === 'login') {
      const stored = await storedPassword();
      if (!stored) return reply(401, { error: 'No password has been set yet. Open the setup link you were sent.' });
      if (typeof password !== 'string' || password.length > 200 || !(await checkPassword(password, stored))) {
        return reply(401, { error: 'Incorrect password.' });
      }
      res.setHeader('Set-Cookie', newSession(stored));
      return reply(200, {});
    }

    if (!(await signedIn(req))) return reply(401, { error: 'Your session expired. Sign in again.' });

    if (action === 'password') {
      const { current } = req.body;
      if (typeof current !== 'string' || current.length > 200 || !(await checkPassword(current, await storedPassword()))) {
        return reply(403, { error: 'Your current password is incorrect.' });
      }
      if (!validPassword) return reply(400, { error: 'Choose a new password of at least 10 characters.' });
      const stored = await hashPassword(password);
      await redis('SET', passwordKey, stored);
      res.setHeader('Set-Cookie', newSession(stored));
      return reply(200, {});
    }

    if (action === 'upload') {
      const id = await upload(req.body);
      if (!id) return reply(400, { error: 'That photo could not be used. Try a JPG or PNG under 10 MB.' });
      return reply(200, { id, url: '/api/image?id=' + id });
    }

    if (action !== 'save') return reply(400, { error: 'Unknown request.' });
    const content = normalize(req.body.content);
    const problem = validate(content);
    if (problem) return reply(400, { error: problem });
    const { revision } = req.body.content;
    if (revision !== null && !uuid(revision)) return reply(400, { error: 'Invalid revision.' });

    const updated = { revision: randomUUID(), ...clean(content) };
    const saved = await redis('EVAL', `
      local current = redis.call('GET', KEYS[1])
      local revision = current and cjson.decode(current).revision or ''
      if revision ~= ARGV[1] then return 0 end
      redis.call('SET', KEYS[1], ARGV[2])
      return 1
    `, 1, contentKey, revision ?? '', JSON.stringify(updated));
    if (!saved) return reply(409, { error: 'Someone published a newer version. Copy any unsaved work, then reload.' });
    await pruneImages(updated).catch(() => {});
    return reply(200, normalize(updated));
  } catch {
    return reply(503, { error: 'Site content is temporarily unavailable. Try again shortly.' });
  }
};
