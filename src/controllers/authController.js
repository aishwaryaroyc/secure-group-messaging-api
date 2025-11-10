// src/controllers/authController.js
// Purpose: Registration & Login with Zod validation, bcrypt password hashing,
// and JWT-based stateless auth. For login, we return generic errors to avoid
// account enumeration. For registration, we return friendly validation errors.

import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User.js';

// --- Registration validation ---
// - Enforces valid email & password length >= 8 (doc expectation).
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// POST /auth/register
export async function register(req, res, next) {
  try {
    // Use safeParse to avoid throwing Zod internals and to format errors cleanly.
    const result = registerSchema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return res.status(400).json({ error: 'Validation failed', errors });
    }

    const { email, password } = result.data;

    // Prevent duplicate registrations.
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: 'Email already registered' });

    // Create user with secure password hash (via user.setPassword()).
    const user = new User({ email });
    await user.setPassword(password);
    await user.save();

    return res.status(201).json({ message: 'Registered' });
  } catch (err) {
    // Handle rare race: unique index collision (email).
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    return next(err);
  }
}

// --- Login validation ---
// NOTE: We accept any non-empty password in login to keep responses generic.
// If you prefer strict UI validation even on login, change min(1) -> min(8).
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /auth/login
export async function login(req, res, next) {
  try {
    // Avoid leaking field-level validation info (security).
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }
    const { email, password } = result.data;

    // Generic invalid-credentials responses to avoid account enumeration.
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await user.validatePassword(password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    // Issue short-lived JWT (12h) signed with JWT_SECRET from .env
    const token = jwt.sign(
      { sub: user._id.toString(), email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    return res.json({ token });
  } catch (err) {
    return next(err);
  }
}
