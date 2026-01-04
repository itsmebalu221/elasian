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

const fastify = Fastify({ logger: false });

// Register CORS - allow credentials for cookies
await fastify.register(fastifyCors, {
  origin: ['https://elasian.vercel.app', 'http://localhost:3000'],
  credentials: true
});

// Register cookie plugin
await fastify.register(fastifyCookie);

// Register session plugin with production-ready settings
await fastify.register(fastifySession, {
  secret: process.env.SESSION_SECRET || 'a-very-long-secret-key-that-should-be-changed-in-production',
  cookieName: 'sessionId',
  cookie: {
    secure: true,
    httpOnly: true,
    sameSite: 'none',  // Required for cross-site cookies
    path: '/',
    maxAge: 24 * 60 * 60 * 1000
  },
  saveUninitialized: false
});

// Register routes
await fastify.register(formRoutes);
await fastify.register(authRoutes);
await fastify.register(studentRoutes);
await fastify.register(paymentRoutes);

// Health check
fastify.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Database init flag
let dbReady = false;

async function initDb() {
  if (!dbReady) {
    try {
      await initializeDatabase();
      dbReady = true;
    } catch (e) {
      console.error('DB Error:', e.message);
    }
  }
}

await initDb();
await fastify.ready();

export default async function handler(req, res) {
  fastify.server.emit('request', req, res);
}
