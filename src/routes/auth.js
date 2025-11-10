// src/routes/auth.js
// Purpose:
// --------
// Handles user authentication endpoints (registration and login).
//
// Features implemented:
//   - User registers with email + password
//   - Zod validation for email/password format
//   - Password is hashed using bcrypt in model layer
//   - Login returns JWT token for sessionless auth
//
// No authorization middleware here — these routes must remain public.

import { Router } from 'express';
import { register, login } from '../controllers/authController.js';

const r = Router();

// Register a new account
r.post('/register', register);

// Login and receive JWT token
r.post('/login', login);

export default r;
