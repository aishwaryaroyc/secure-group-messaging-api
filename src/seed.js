// src/seed.js
// Purpose
// -------
// A utility script used to seed a demo user into the database.
// This is useful for testing authentication flows during development.
// When executed, it ensures a test user with known credentials exists.
//
// Notes
// -----
// - Uses dotenv to load environment variables.
// - Uses the same User model & db connection functions as the main server.
// - This file is not exposed via API; it's a developer tool.
// - Always run this in a controlled environment (never in production unless intended).

import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from './config/db.js';
import User from './models/User.js';

// Establish database connection
await connectDB(process.env.MONGO_URI);

const email = 'demo@example.com';

// Try to find an existing demo user
let user = await User.findOne({ email });

// If missing, create the demo user
if (!user) {
  user = new User({ email });
  await user.setPassword('Password123'); // NOTE: for demo/testing only
  await user.save();
}

console.log('Seeded user:', email);

// Gracefully exit the script
process.exit(0);
