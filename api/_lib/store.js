// Shared storage + admin-session helpers for the /api functions.
// Files under api/_lib are not routes (Vercel skips paths that start with "_").
const { createHash, createHmac, timingSafeEqual } = require('node:crypto');

const sessionName = '__Host-drkem_admin';

// The Vercel Marketplace "Upstash for Redis" integration names its variables
// KV_REST_API_*; a manually created Upstash database uses UPSTASH_REDIS_REST_*.
const redisUrl = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const storageConfigured = () => !!(redisUrl() && redisToken());
const adminConfigured = () => !!(storageConfigured() && process.env.DRKEM_ADMIN_PASSWORD && process.env.DRKEM_SESSION_SECRET);

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

function sessionCookie(value) {
  return sessionName + '=' + value + '; Path=/; HttpOnly; Secure; SameSite=Strict';
}

module.exports = { redis, equal, signature, signedIn, sessionCookie, storageConfigured, adminConfigured };
