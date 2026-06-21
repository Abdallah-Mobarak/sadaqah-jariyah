// Helper middleware: security headers + a simple rate limiter (no external libraries)

// Basic security headers for every request
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

// In-memory rate limiter — fine for a small single-process site
// options: { windowMs, max, message, onLimit? }
function rateLimit({ windowMs, max, message, onLimit }) {
  const hits = new Map();
  // Periodic memory cleanup
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [ip, arr] of hits) {
      const kept = arr.filter((t) => now - t < windowMs);
      if (kept.length) hits.set(ip, kept);
      else hits.delete(ip);
    }
  }, windowMs);
  if (cleanup.unref) cleanup.unref();

  return function (req, res, next) {
    const now = Date.now();
    const ip = req.ip || req.connection.remoteAddress || 'x';
    const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) {
      if (onLimit) return onLimit(req, res);
      return res.status(429).json({ ok: false, error: message || 'محاولات كثيرة، انتظر قليلاً.' });
    }
    arr.push(now);
    hits.set(ip, arr);
    next();
  };
}

module.exports = { securityHeaders, rateLimit };
