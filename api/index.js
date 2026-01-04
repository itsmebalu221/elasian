import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import dotenv from 'dotenv';

import { formRoutes } from '../src/Routes/form.routes.js';
import { authRoutes } from '../src/Routes/auth.routes.js';
import { studentRoutes } from '../src/Routes/student.routes.js';
import { paymentRoutes } from '../src/Routes/payment.routes.js';
import { initializeDatabase } from '../src/db/mysql.js';
import { verifyToken, getCookieName, getCookieOptions } from '../src/utils/jwt.js';

dotenv.config();

const fastify = Fastify({ logger: false });

// Register CORS - allow credentials for cookies
await fastify.register(fastifyCors, {
  origin: ['https://elasian.vercel.app', 'http://localhost:3000'],
  credentials: true
});

// Register cookie plugin
await fastify.register(fastifyCookie);

// Decorate request with user property populated from JWT cookie
fastify.decorateRequest('user', null);

fastify.addHook('preHandler', async (request, reply) => {
  const token = request.cookies?.[getCookieName()];

  if (!token) {
    request.user = null;
    return;
  }

  try {
    request.user = verifyToken(token);
  } catch (error) {
    console.warn('Invalid auth token:', error.message);
    request.user = null;
    reply.clearCookie(getCookieName(), getCookieOptions());
  }
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
