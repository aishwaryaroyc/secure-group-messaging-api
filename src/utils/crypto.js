// src/utils/crypto.js
// Purpose
// -------
// Encrypt/decrypt message payloads using AES-128-GCM.
// We store an opaque base64 payload containing IV + AuthTag + Ciphertext.
// Decryption returns the original UTF-8 message.
//
// Security Notes
// --------------
// - AES-128-GCM provides confidentiality and integrity (via the auth tag).
// - Key is provided via env var `AES_128_KEY_BASE64` (16 bytes in base64).
// - A fresh 96-bit IV is generated per message as recommended for GCM.
// - Payload layout: [IV(12 bytes)] + [TAG(16 bytes)] + [CIPHERTEXT]
// - We do NOT hardcode keys; rotation can be handled at deploy time.
//
// Operational Notes
// -----------------
// - If `AES_128_KEY_BASE64` is missing or wrong length, we throw early to
//   prevent booting into an insecure or half-working state.
// - Keep message size limits enforced in controllers to avoid large ciphertext blobs.

import crypto from 'crypto';

// Resolve a 16-byte AES key from base64 env var. Fail fast if misconfigured.
function getKey() {
  const b64 = process.env.AES_128_KEY_BASE64;
  if (!b64) throw new Error('AES_128_KEY_BASE64 env missing');
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 16) throw new Error('AES-128 key must be 16 bytes');
  return key;
}

// Encrypts a UTF-8 string, returns base64(IV || TAG || CIPHERTEXT)
export function encryptMessage(plaintext) {
  const key = getKey();

  // 96-bit IV is standard for GCM
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-128-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Store IV + TAG + CIPHERTEXT in that order (base64-encoded)
  const payload = Buffer.concat([iv, tag, ciphertext]).toString('base64');
  return payload;
}

// Accepts base64(IV || TAG || CIPHERTEXT) and returns the original UTF-8 string
export function decryptMessage(payloadB64) {
  const key = getKey();

  const buf = Buffer.from(payloadB64, 'base64');
  const iv = buf.subarray(0, 12);      // 12 bytes
  const tag = buf.subarray(12, 28);    // next 16 bytes
  const ciphertext = buf.subarray(28); // remaining

  const decipher = crypto.createDecipheriv('aes-128-gcm', key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return plaintext;
}
