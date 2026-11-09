// Minimal in-memory fixed-window rate limiter (no extra dependencies).
// Behind Cloudflare/Render the real client IP is in `cf-connecting-ip`.
// X-Forwarded-For is deliberately NOT trusted (clients can forge it).
function clientKey(req) {
  return req.headers['cf-connecting-ip'] || req.ip || 'unknown';
}

function createRateLimiter({ windowMs, max, exemptOrigins = [] }) {
  const hits = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, Math.max(windowMs, 60 * 1000));
  if (timer.unref) timer.unref();

  return function rateLimit(req, res, next) {
    if (exemptOrigins.includes(req.headers.origin)) return next();
    const now = Date.now();
    const key = clientKey(req);
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Too many requests. Please try again later.', retryAfter });
    }
    next();
  };
}

module.exports = { createRateLimiter, clientKey };
