import Fastify from 'fastify';
import fastifySession from '@fastify/session';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import dotenv from 'dotenv';

import { formRoutes } from '../src/Routes/form.routes.js';
import { authRoutes } from '../src/Routes/auth.routes.js';
import { studentRoutes } from '../src/Routes/student.routes.js';
import { paymentRoutes } from '../src/Routes/payment.routes.js';
import { initializeDatabase } from '../src/db/mysql.js';

dotenv.config();

const fastify = Fastify({ logger: true });

// Register CORS
fastify.register(fastifyCors, {
  origin: true,
  credentials: true
});

// Register cookie plugin
fastify.register(fastifyCookie);

// Register session plugin
fastify.register(fastifySession, {
  secret: process.env.SESSION_SECRET || 'a-very-long-secret-key-that-should-be-changed-in-production',
  cookie: {
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  },
  saveUninitialized: false
});

// Register routes
fastify.register(formRoutes);
fastify.register(authRoutes);
fastify.register(studentRoutes);
fastify.register(paymentRoutes);

// Health check
fastify.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Database init flag
let dbReady = false;

export default async function handler(req, res) {
  if (!dbReady) {
    try {
      await initializeDatabase();
      dbReady = true;
    } catch (e) {
      console.error('DB Error:', e);
    }
  }
  await fastify.ready();
  fastify.server.emit('request', req, res);
}
