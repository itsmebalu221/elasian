import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifySession from '@fastify/session';
import fastifyCookie from '@fastify/cookie';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { formRoutes } from './src/Routes/form.routes.js';
import { authRoutes } from './src/Routes/auth.routes.js';
import { studentRoutes } from './src/Routes/student.routes.js';
import { initializeDatabase } from './src/db/mysql.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({ logger: true });

// Register cookie plugin (required for sessions)
fastify.register(fastifyCookie);

// Register session plugin
fastify.register(fastifySession, {
  secret: process.env.SESSION_SECRET || 'a-very-long-secret-key-that-should-be-changed-in-production',
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  saveUninitialized: false
});

// Register static file serving for public folder
fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'public'),
  prefix: '/'
});

// Register static file serving for Assets folder
fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'Assets'),
  prefix: '/assets/',
  decorateReply: false
});

// Register routes
fastify.register(formRoutes);
fastify.register(authRoutes);
fastify.register(studentRoutes);

// Root redirect to login
fastify.get('/', async (request, reply) => {
  return reply.redirect('/login.html');
});

// Health check endpoint
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Start server
const start = async () => {
  try {
    // Initialize database tables
    await initializeDatabase();
    
    const port = process.env.PORT || 3000;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Server running at http://localhost:${port}`);
    console.log(`📝 Login page: http://localhost:${port}/login.html`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
