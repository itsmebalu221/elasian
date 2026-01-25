import { admitSelection, getCheckinConfig, lookupPass, CheckinError } from '../Services/checkin.service.js';
import { signGateStaffToken, getCookieName, getGateStaffCookieOptions, getClearCookieOptions } from '../utils/jwt.js';

// Allowed gate staff emails (can also be set via env)
const GATE_STAFF_EMAILS = (process.env.GATE_STAFF_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const BASIC_LOGIN_EMAILS = (process.env.GATE_STAFF_BASIC_EMAILS || process.env.GATE_STAFF_BASIC_EMAIL || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);
const BASIC_LOGIN_PASSWORD = (process.env.GATE_STAFF_BASIC_PASSWORD || process.env.GATE_STAFF_BASIC_PASS || '').toString();

function isGateStaffEmail(email) {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  
  // Check explicit list
  if (GATE_STAFF_EMAILS.includes(normalized)) return true;
  
  // Allow all @hitam.org and @elysianhitam.com emails as gate staff
  if (normalized.endsWith('@hitam.org')) return true;
  if (normalized.endsWith('@elysianhitam.com')) return true;
  
  return false;
}

function handleError(res, error) {
  const status = error instanceof CheckinError ? error.status : 500;
  const code = error instanceof CheckinError ? error.code : 'CHECKIN_ERROR';

  console.error('Check-in error:', code, error.message);
  return res.status(status).json({
    success: false,
    error: error.message,
    code
  });
}

export function fetchConfig(req, res) {
  const config = getCheckinConfig();
  return res.json({
    success: true,
    config
  });
}

export async function lookupRegistration(req, res) {
  try {
    const { token, qr, registrationId, day } = req.body || {};
    
    // If registrationId is provided directly, skip QR token extraction
    const isDirectLookup = !!registrationId && !token && !qr;
    const payload = registrationId || token || qr;
    const result = await lookupPass(payload, day, { skipExtract: isDirectLookup });

    return res.json({
      success: true,
      result
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function admitGuests(req, res) {
  try {
    const { attendanceIds, day, passType } = req.body || {};
    const operator = req.user?.email || 'system';
    const result = await admitSelection({ attendanceIds, dayId: day, operator, passType });

    return res.json({
      success: true,
      result
    });
  } catch (error) {
    return handleError(res, error);
  }
}

// Simple email/password login for gate staff (24-hour session)
export async function gateStaffLoginBasic(req, res) {
  try {
    const { email, password } = req.body || {};

    if (!BASIC_LOGIN_EMAILS.length || !BASIC_LOGIN_PASSWORD) {
      return res.status(500).json({
        success: false,
        error: 'Basic gate login is not configured'
      });
    }

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!BASIC_LOGIN_EMAILS.includes(normalizedEmail) || password !== BASIC_LOGIN_PASSWORD) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const token = signGateStaffToken({
      id: `basic_${Date.now()}`,
      email: normalizedEmail,
      name: normalizedEmail.split('@')[0],
      picture: null,
      userType: 'GATESTAFF'
    });

    res.cookie(getCookieName(), token, getGateStaffCookieOptions());

    return res.json({
      success: true,
      user: {
        email: normalizedEmail,
        name: normalizedEmail.split('@')[0],
        userType: 'GATESTAFF'
      }
    });
  } catch (error) {
    console.error('Gate staff basic login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
}

export function gateStaffLogout(req, res) {
  res.clearCookie(getCookieName(), getClearCookieOptions());
  return res.json({ success: true, message: 'Logged out' });
}

export function getGateStaffSession(req, res) {
  if (req.user && (req.user.userType === 'GATESTAFF' || req.user.userType === 'HITAMONLY')) {
    return res.json({
      success: true,
      authenticated: true,
      user: {
        email: req.user.email,
        name: req.user.name,
        userType: req.user.userType
      }
    });
  }
  return res.json({
    success: true,
    authenticated: false
  });
}
