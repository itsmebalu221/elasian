import { admitSelection, getCheckinConfig, lookupPass, CheckinError } from '../Services/checkin.service.js';
import { signToken, getCookieName, getCookieOptions, getClearCookieOptions } from '../utils/jwt.js';
import { findOrCreateUser } from '../config/firebase.js';

// Allowed gate staff emails (can also be set via env)
const GATE_STAFF_EMAILS = (process.env.GATE_STAFF_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

function isGateStaffEmail(email) {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  
  // Check explicit list
  if (GATE_STAFF_EMAILS.includes(normalized)) return true;
  
  // Allow all @hitam.org emails as gate staff
  if (normalized.endsWith('@hitam.org')) return true;
  
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
    const { attendanceIds, day } = req.body || {};
    const operator = req.user?.email || 'system';
    const result = await admitSelection({ attendanceIds, dayId: day, operator });

    return res.json({
      success: true,
      result
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function gateStaffLogin(req, res) {
  try {
    const { user } = req.body || {};

    if (!user || !user.email) {
      return res.status(400).json({
        success: false,
        error: 'Firebase user data is required'
      });
    }

    const email = user.email.toLowerCase().trim();
    
    // Check if user is allowed as gate staff
    if (!isGateStaffEmail(email)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only authorized staff can access gate check-in.'
      });
    }

    // Find or create user in database
    let dbUser;
    try {
      dbUser = await findOrCreateUser({
        uid: user.uid || `firebase_${Date.now()}`,
        email,
        displayName: user.displayName || email.split('@')[0],
        photoURL: user.photoURL || null
      });
    } catch (dbError) {
      console.error('Database error during gate login:', dbError);
      dbUser = {
        id: `session_${Date.now()}`,
        email,
        name: user.displayName || email.split('@')[0],
        is_temporary: true
      };
    }

    const token = signToken({
      id: dbUser.id,
      email,
      name: user.displayName || dbUser.name || email.split('@')[0],
      picture: user.photoURL || dbUser.profile_picture || null,
      userType: 'GATESTAFF'
    });

    res.cookie(getCookieName(), token, getCookieOptions());
    
    return res.json({
      success: true,
      user: {
        email,
        name: user.displayName || dbUser.name,
        picture: user.photoURL || null,
        userType: 'GATESTAFF'
      }
    });

  } catch (error) {
    console.error('Gate staff login error:', error);
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
