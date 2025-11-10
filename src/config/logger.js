// src/config/logger.js
// Purpose
// -------
// Wraps Winston logger in a structured, timestamped logging configuration.
// Used across the application for consistent server-side diagnostic output.
//
// Notes
// -----
// - Level can be adjusted via LOG_LEVEL env.
// - JSON logs are a good fit for cloud environments & log aggregators.
// - Includes stack traces for error logs via `format.errors({ stack: true })`.

import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',

  format: winston.format.combine(
    // Include timestamps for each log entry
    winston.format.timestamp(),

    // Capture error stack traces where applicable
    winston.format.errors({ stack: true }),

    // Output valid JSON logs
    winston.format.json()
  ),

  // Log to console (can add file or external transports later)
  transports: [new winston.transports.Console()],
});

export default logger;
