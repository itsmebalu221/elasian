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
  const isVercel = !!process.env.VERCEL;
  const isProduction = process.env.NODE_ENV === 'production' || isVercel;
  const appUrl = process.env.APP_URL || '';
  const isLocalhost = appUrl.includes('localhost') || appUrl.includes('127.0.0.1');
  
  // For Vercel or production HTTPS, use secure cookies
  // For localhost, we need secure=false
  const useSecure = isVercel || (isProduction && !isLocalhost);
  
  const options = {
    httpOnly: true,
    secure: useSecure,
    sameSite: useSecure ? 'none' : 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 // seconds
  };
  
  // Log cookie settings on first call in production
  if (isVercel) {
    console.log('🍪 Cookie settings:', { secure: options.secure, sameSite: options.sameSite });
  }
  
  return options;
}

export function sanitizeUserPayload(user) {
  if (!user) {
    return null;
  }

  // Remove JWT metadata that should not be re-signed
  const { iat, exp, nbf, jti, ...rest } = user;
  return rest;
}
