import jwt from 'jsonwebtoken';

const DEFAULT_EXPIRY = '24h';
const COOKIE_NAME = 'elysian_token';

function getSecret() {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('JWT secret is not configured. Set JWT_SECRET or SESSION_SECRET');
  }
  return secret;
}

export function signToken(payload, options = {}) {
  return jwt.sign(payload, getSecret(), {
    expiresIn: DEFAULT_EXPIRY,
    ...options
  });
}

export function verifyToken(token) {
  return jwt.verify(token, getSecret());
}

export function getCookieName() {
  return COOKIE_NAME;
}

export function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',  // Use 'lax' to allow cookies on redirect from payment gateway
    path: '/',
    maxAge: 24 * 60 * 60 // seconds
  };
}

export function sanitizeUserPayload(user) {
  if (!user) {
    return null;
  }

  // Remove JWT metadata that should not be re-signed
  const { iat, exp, nbf, jti, ...rest } = user;
  return rest;
}
