// Shared storage + admin-session helpers for the /api functions.
// Files under api/_lib are not routes (Vercel skips paths that start with "_").
const { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');

const sessionName = '__Host-drkem_admin';
const passwordKey = 'drkem:admin-password';  // scrypt hash of the admin password
const scryptAsync = promisify(scrypt);

// The Vercel Marketplace "Upstash for Redis" integration names its variables
// KV_REST_API_*; a manually created Upstash database uses UPSTASH_REDIS_REST_*.
const redisUrl = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const storageConfigured = () => !!(redisUrl() && redisToken());
const adminConfigured = () => !!(storageConfigured() && process.env.DRKEM_SESSION_SECRET);

async function redis(...command) {
  const response = await fetch(redisUrl(), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + redisToken(), 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(8000),
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error('Storage unavailable');
  return data.result;
}

function equal(a, b) {
  const hash = value => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(a), hash(b));
}

const hmac = value => createHmac('sha256', process.env.DRKEM_SESSION_SECRET).update(value).digest('hex');

// The admin password is chosen by Dr. Kem on the setup page and stored only as
// a salted scrypt hash. Until one is stored, the setup link can set it.
const storedPassword = () => redis('GET', passwordKey);

async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return 'scrypt$' + salt.toString('hex') + '$' + hash.toString('hex');
}

async function checkPassword(password, stored) {
  const [kind, salt, hash] = String(stored || '').split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const attempt = await scryptAsync(password, Buffer.from(salt, 'hex'), 64);
  return timingSafeEqual(attempt, Buffer.from(hash, 'hex'));
}

// Only works while no password is stored. To issue a new link after a
// forgotten password, delete the drkem:admin-password key in Upstash.
const setupToken = () => hmac('drkem-setup-v1').slice(0, 32);

// Sessions are tied to the current password hash, so changing the password
// signs out every other browser.
const signature = (expiry, stored) => hmac(sessionName + ':' + expiry + ':' + stored);

async function signedIn(req) {
  if (!adminConfigured()) return false;
  const cookie = (req.headers.cookie || '').split(/;\s*/).find(value => value.startsWith(sessionName + '='));
  const [expiry, mac] = cookie?.slice(sessionName.length + 1).split('.') || [];
  if (!/^\d{13}$/.test(expiry) || Number(expiry) <= Date.now() || !mac) return false;
  const stored = await storedPassword();
  return !!stored && equal(signature(expiry, stored), mac);
}

function sessionCookie(value) {
  return sessionName + '=' + value + '; Path=/; HttpOnly; Secure; SameSite=Strict';
}

function newSession(stored) {
  const expiry = Date.now() + 8 * 60 * 60 * 1000;
  return sessionCookie(expiry + '.' + signature(expiry, stored) + '; Max-Age=28800');
}

module.exports = {
  redis, equal, passwordKey, storedPassword, hashPassword, checkPassword, setupToken,
  signedIn, sessionCookie, newSession, storageConfigured, adminConfigured,
};
