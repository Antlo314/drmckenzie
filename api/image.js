// Serves photos uploaded through /admin. Each upload gets a new id, so a
// stored photo never changes and browsers and the CDN may keep it for a year.
const { redis, storageConfigured } = require('./_lib/store');

module.exports = async (req, res) => {
  const id = String(req.query?.id || '');
  if (req.method !== 'GET' || !/^[a-f0-9-]{36}$/.test(id) || !storageConfigured()) {
    return res.status(404).end();
  }
  try {
    const stored = JSON.parse(await redis('GET', 'drkem:img:' + id) ?? 'null');
    if (!stored) return res.status(404).end();
    res.setHeader('Content-Type', stored.type);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(Buffer.from(stored.data, 'base64'));
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).end();
  }
};
