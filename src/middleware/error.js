// src/middleware/error.js
// Purpose
// -------
// Centralized Express error handling & "not found" responder.
// - `notFound` converts unmatched routes to a 404 JSON error.
// - `errorHandler` logs the error and returns a sanitized JSON payload.
//
// Notes
// -----
// - We log the error (message + stack) for operators, but
//   return a concise message to the client.
// - `err.status` can be set upstream for custom HTTP codes.
// - Keep messages generic for security; avoid leaking internals.

import logger from '../config/logger.js';

// Handle unknown routes uniformly (JSON 404)
export function notFound(req, res, next) {
  res.status(404).json({ error: 'Not found' });
}

// Central error handler (must be the last middleware in the chain)
export function errorHandler(err, req, res, next) {
  // Structured logging for observability (no PII)
  logger.error('Unhandled error', { message: err.message, stack: err.stack });

  // Allow upstream to set an HTTP status; default to 500
  const status = err.status || 500;

  // Return a sanitized JSON error. Do not leak stack traces to clients.
  res.status(status).json({ error: err.message || 'Server error' });
}
