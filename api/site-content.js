const { createHash, createHmac, timingSafeEqual, randomUUID } = require('node:crypto');

const contentKey = 'drkem:site-content:v1';
const sessionName = '__Host-drkem_admin';
const empty = { revision: null, theme: 'original', accent: '#17684e', secondary: '#195b86', announcement: '', events: [] };

async function redis(...command) {
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.UPSTASH_REDIS_REST_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(5000),
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error('Storage unavailable');
  return data.result;
}

function equal(a, b) {
  const hash = value => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(a), hash(b));
}

function signature(expiry) {
  return createHmac('sha256', process.env.DRKEM_SESSION_SECRET)
    .update(sessionName + ':' + expiry + ':' + process.env.DRKEM_ADMIN_PASSWORD).digest('hex');
}

function signedIn(req) {
  if (!process.env.DRKEM_SESSION_SECRET || !process.env.DRKEM_ADMIN_PASSWORD) return false;
  const cookie = (req.headers.cookie || '').split(/;\s*/).find(value => value.startsWith(sessionName + '='));
  const [expiry, mac] = cookie?.slice(sessionName.length + 1).split('.') || [];
  return /^\d{13}$/.test(expiry) && Number(expiry) > Date.now() && !!mac && equal(signature(expiry), mac);
}

function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01') return false;
  const parsed = new Date(value);
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === value;
}

function validate(content) {
  const string = (value, length) => typeof value === 'string' && value.length <= length;
  const color = value => string(value, 7) && /^#[a-f\d]{6}$/i.test(value);
  if (!content || !['original', 'green-blue', 'custom'].includes(content.theme) ||
      !color(content.accent) || !color(content.secondary) || !string(content.announcement, 240) ||
      !Array.isArray(content.events) || content.events.length > 50) return false;

  const ids = new Set();
  return content.events.every(event => {
    if (!event || !string(event.id, 36) || !/^[a-f0-9-]{36}$/.test(event.id) || ids.has(event.id) ||
        !string(event.title, 120) || !event.title.trim() || !date(event.date) ||
        !string(event.details, 900) || !string(event.location, 140) ||
        typeof event.published !== 'boolean' || !string(event.url, 500)) return false;
    ids.add(event.id);
    if (!event.url) return true;
    try {
      const url = new URL(event.url);
      return url.protocol === 'https:' && !url.username && !url.password;
    } catch {
      return false;
    }
  });
}

async function readContent() {
  return JSON.parse(await redis('GET', contentKey) ?? 'null') ?? empty;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const admin = req.query?.admin === '1';
  const reply = (status, value) => res.status(status).json(value);
  const configured = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;
  try {
    if (req.method === 'GET') {
      if (admin && !signedIn(req)) return reply(401, { error: 'Sign in to continue.' });
      if (admin && !configured) return reply(503, { error: 'Site storage needs to be configured.' });
      const content = configured ? await readContent() : empty;
      if (admin) return reply(200, content);
      const { theme, accent, secondary, announcement, events } = content;
      return reply(200, { theme, accent, secondary, announcement, events: events.filter(event => event.published) });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return reply(405, { error: 'Method unavailable.' });
    }
    // Browser requests from other origins cannot send this header without a CORS preflight.
    if (req.headers['x-drkem-admin'] !== '1' || typeof req.body !== 'object' || !req.body) {
      return reply(403, { error: 'Invalid admin request.' });
    }
    const cookie = value => res.setHeader('Set-Cookie', sessionName + '=' + value + '; Path=/; HttpOnly; Secure; SameSite=Strict');
    if (req.body.action === 'logout') {
      cookie('; Max-Age=0');
      return reply(200, {});
    }
    if (!configured || !process.env.DRKEM_ADMIN_PASSWORD || !process.env.DRKEM_SESSION_SECRET) {
      return reply(503, { error: 'Admin sign-in and storage need to be configured.' });
    }
    if (req.body.action === 'login') {
      const ip = String(req.headers['x-real-ip'] || req.socket.remoteAddress || '').slice(0, 80);
      const attempts = await redis('EVAL',
        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
        1, 'drkem:signin:' + ip);
      if (attempts > 12) return reply(429, { error: 'Too many attempts. Try again in a minute.' });
      const { password } = req.body;
      if (typeof password !== 'string' || password.length > 512 || !equal(password, process.env.DRKEM_ADMIN_PASSWORD)) {
        return reply(401, { error: 'Incorrect password.' });
      }
      const expiry = Date.now() + 8 * 60 * 60 * 1000;
      cookie(expiry + '.' + signature(expiry) + '; Max-Age=28800');
      return reply(200, {});
    }
    if (!signedIn(req)) return reply(401, { error: 'Your session expired. Sign in again.' });
    if (req.body.action !== 'save' || !validate(req.body.content)) {
      return reply(400, { error: 'Check the event details, colors, and HTTPS links.' });
    }
    const { revision, theme, accent, secondary, announcement, events } = req.body.content;
    if (revision !== null && (typeof revision !== 'string' || !/^[a-f0-9-]{36}$/.test(revision))) {
      return reply(400, { error: 'Invalid revision.' });
    }
    const records = events.map(({ id, title, date, details, location, url, published }) =>
      ({ id, title, date, details, location, url, published }));
    const updated = { revision: randomUUID(), theme, accent, secondary, announcement: announcement.trim(), events: records };
    const saved = await redis('EVAL', `
      local current = redis.call('GET', KEYS[1])
      local revision = current and cjson.decode(current).revision or ''
      if revision ~= ARGV[1] then return 0 end
      redis.call('SET', KEYS[1], ARGV[2])
      return 1
    `, 1, contentKey, revision ?? '', JSON.stringify(updated));
    if (!saved) return reply(409, { error: 'Someone published a newer version. Copy any unsaved work, then reload.' });
    return reply(200, updated);
  } catch {
    return reply(503, { error: 'Site content is temporarily unavailable. Try again shortly.' });
  }
};
