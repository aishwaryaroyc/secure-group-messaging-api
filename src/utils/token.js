// src/utils/token.js
// Purpose
// -------
// Utilities for generating and hashing opaque tokens (e.g., invite tokens).
//
// Design
// ------
// - `generateRawToken` produces a URL-safe, high-entropy random token using
//   Node's CSPRNG. We only show this raw value ONCE to the caller.
// - We store only a SHA-256 hash of the token server-side (like passwords),
//   so that a DB leak does not expose usable invite tokens.
// - Consumers compare by hashing the presented token and matching the stored hash.

import crypto from 'crypto';

// Create a URL-safe random token (default 24 bytes ≈ 32 chars base64url).
// Increase `bytes` for even stronger tokens if needed.
export function generateRawToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url'); // URL-safe (no +/ or =)
}

// One-way hash (hex) for storing & comparing tokens securely.
export function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}
