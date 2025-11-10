// src/middleware/auth.js
// Purpose
// -------
// Authenticate requests using a Bearer JWT sent in the Authorization header.
// On success, attaches a minimal `req.user` (id, email) for downstream handlers.
// On failure, returns 401 with a generic message (no sensitive details).
//
// Notes
// -----
// - Uses `JWT_SECRET` from environment to verify tokens.
// - Keeps responses generic to avoid token/identity leakage.
// - If you later rotate secrets, issue short-lived tokens + consider key IDs (kid).

import jwt from 'jsonwebtoken';

export function authRequired(req, res, next) {
  // Expect: Authorization: Bearer <token>
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;

  if (!token) {
    // No token → unauthenticated
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    // Verify signature & expiration using server-side secret.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach a minimal principal for controllers to use.
    // (Avoid attaching the full token claims surface to reduce coupling.)
    req.user = { id: decoded.sub, email: decoded.email };

    return next();
  } catch (err) {
    // Invalid/expired token → unauthenticated (generic message on purpose)
    return res.status(401).json({ error: 'Invalid token' });
  }
}
