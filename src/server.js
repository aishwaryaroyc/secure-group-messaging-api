// src/server.js
// Purpose
// -------
// Bootstraps and configures the Express application.
// Loads environment variables, initializes middleware, connects to DB,
// configures Swagger documentation, mounts API routes, and starts HTTP server.
//
// Security Notes
// --------------
// - helmet() adds hardened HTTP headers.
// - cors() restricts cross-origin access if configured.
// - express.json limit prevents payload abuse.
// - Swagger docs available at /docs.
//
// Development Notes
// -----------------
// - morgan logs HTTP requests for debugging.
// - DB connection occurs BEFORE server start to prevent serving without DB.

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import YAML from 'yamljs';
import swaggerUi from 'swagger-ui-express';

import { connectDB } from './config/db.js';
import logger from './config/logger.js';
import authRoutes from './routes/auth.js';
import groupRoutes from './routes/groups.js';
import messageRoutes from './routes/messages.js';
import { notFound, errorHandler } from './middleware/error.js';

// Load environment variables
dotenv.config();

const app = express();

// Enable JSON body parsing with size limit for safety
app.use(express.json({ limit: '1mb' }));

// Apply standard security middleware
app.use(cors());
app.use(helmet());

// Log HTTP requests in development style
app.use(morgan('dev'));

// Load and serve Swagger API documentation
const swaggerDoc = YAML.load(new URL('../swagger.yaml', import.meta.url));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// Route registration
app.use('/auth', authRoutes);
app.use('/groups', groupRoutes);
app.use('/messages', messageRoutes);

// Handle unknown routes + centralized error handler
app.use(notFound);
app.use(errorHandler);

// Assign port with fallback
const PORT = process.env.PORT || 4000;

// Connect to MongoDB before accepting HTTP traffic
await connectDB(process.env.MONGO_URI);

// Start HTTP server
app.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
});
