function securityHeaders(req, res, next) {
  res.set({
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  });
  if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000');
  next();
}

// Fixed windows with a bounded key store. Deliberately uses Express's socket IP:
// never trust caller-supplied X-Forwarded-For without a configured proxy policy.
function createAuthLimiter({ limit = 20, windowMs = 15 * 60 * 1000, now = Date.now, maxKeys = 10000 } = {}) {
  const clients = new Map();
  return function authLimiter(req, res, next) {
    if (req.method !== 'POST') return next();
    const time = now();
    for (const [key, entry] of clients) if (entry.resetAt <= time) clients.delete(key);
    const key = req.ip;
    let entry = clients.get(key);
    if (!entry) {
      if (clients.size >= maxKeys) {
        res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
        return res.status(429).json({ status: 'error', message: 'Demasiados intentos. Intenta de nuevo más tarde.' });
      }
      entry = { count: 0, resetAt: time + windowMs };
      clients.set(key, entry);
    }
    entry.count++;
    if (entry.count > limit) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - time) / 1000))));
      return res.status(429).json({ status: 'error', message: 'Demasiados intentos. Intenta de nuevo más tarde.' });
    }
    next();
  };
}
module.exports = { securityHeaders, createAuthLimiter };
