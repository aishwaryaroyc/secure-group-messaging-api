// src/config/db.js
// Purpose
// -------
// Centralized MongoDB connection module for the application.
// Ensures that database connection state is logged and termination on failure is graceful.
//
// Notes
// -----
// - Uses Mongoose's .connect() with URI from env.
// - Enables `strictQuery` for safer query filtering.
// - On failure, logs error and exits process to avoid half-initialized app.

import mongoose from 'mongoose';
import logger from './logger.js';

export async function connectDB(uri) {
  try {
    // Enforce strict mode for query filtering (avoids accidental broad queries)
    mongoose.set('strictQuery', true);

    // Attempt connection
    await mongoose.connect(uri);

    logger.info('MongoDB connected');

  } catch (err) {
    // Log and halt if DB connection fails
    logger.error('MongoDB connection error', { err: err.message });

    // Fail fast — continuing without DB creates inconsistent app state
    process.exit(1);
  }
}
