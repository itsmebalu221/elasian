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
import { initializeDatabase } from './src/db/mysql.js';
import { verifyToken, getCookieName, getCookieOptions } from './src/utils/jwt.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

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
    res.clearCookie(getCookieName(), getCookieOptions());
  }

  return next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'Assets')));

formRoutes(app);
authRoutes(app);
studentRoutes(app);
paymentRoutes(app);

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
