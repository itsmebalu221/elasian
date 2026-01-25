import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { formRoutes } from './src/Routes/form.routes.js';
import { authRoutes } from './src/Routes/auth.routes.js';
import { studentRoutes } from './src/Routes/student.routes.js';
import { paymentRoutes } from './src/Routes/payment.routes.js';
import { externalRoutes } from './src/Routes/external.routes.js';
import { eventRoutes } from './src/Routes/event.routes.js';
import { butterflyRoutes } from './src/Routes/butterfly.routes.js';
import { alumniRoutes } from './src/Routes/alumni.routes.js';
import { checkinRoutes } from './src/Routes/checkin.routes.js';
import { adminRoutes } from './src/Routes/admin.routes.js';
import { initializeDatabase } from './src/db/mysql.js';
import { verifyToken, getCookieName, getClearCookieOptions } from './src/utils/jwt.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(self)');
  next();
});

// Simple rate limiting for API endpoints (in-memory, resets on restart)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 10000; // 10000 requests per hour per IP

function rateLimiter(req, res, next) {
  // Only rate limit API endpoints
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  // Skip rate limiting for checkin endpoints (they have auth protection)
  if (req.path.startsWith('/api/checkin/')) {
    return next();
  }

  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, startTime: now });
    return next();
  }

  const record = rateLimitMap.get(ip);

  if (now - record.startTime > RATE_LIMIT_WINDOW_MS) {
    // Reset window
    rateLimitMap.set(ip, { count: 1, startTime: now });
    return next();
  }

  record.count++;

  if (record.count > RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - record.startTime)) / 1000)
    });
  }

  return next();
}

// Clean up rate limit map periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now - record.startTime > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter);

// Short-circuit CORS preflight requests before hitting auth middleware
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use((req, res, next) => {
  const token = req.cookies?.[getCookieName()];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    req.user = verifyToken(token);
  } catch (error) {
    console.warn('Invalid auth token:', error.message);
    req.user = null;
    res.clearCookie(getCookieName(), getClearCookieOptions());
  }

  return next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'Assets')));

formRoutes(app);
authRoutes(app);
studentRoutes(app);
paymentRoutes(app);
externalRoutes(app);
eventRoutes(app);
butterflyRoutes(app);
alumniRoutes(app);
checkinRoutes(app);
adminRoutes(app);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

let dbInitialized = false;

async function ensureDbReady() {
  if (!dbInitialized) {
    try {
      await initializeDatabase();
      dbInitialized = true;
    } catch (err) {
      console.error('DB init error:', err);
    }
  }
}

export default async function handler(req, res) {
  await ensureDbReady();
  return app(req, res);
}

if (!process.env.VERCEL) {
  const start = async () => {
    try {
      await ensureDbReady();
      const port = process.env.PORT || 3000;
      app.listen(port, '0.0.0.0', () => {
        console.log(`🚀 Server running at http://localhost:${port}`);
        console.log(`📝 Login page: http://localhost:${port}/login.html`);
      });
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  };

  start();
}
