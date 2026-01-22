import { admitSelection, getCheckinConfig, lookupPass, CheckinError } from '../Services/checkin.service.js';
import { signToken, getCookieName, getCookieOptions, getClearCookieOptions } from '../utils/jwt.js';
import bcrypt from 'bcryptjs';

// Gate staff credentials - in production, store hashed passwords in DB
const GATE_STAFF = [
  { email: 'gate1@elysian.com', passwordHash: '$2a$10$XQxBtJXKQKQKQKQKQKQKQOxxx', name: 'Gate 1 Staff' },
  { email: 'gate2@elysian.com', passwordHash: '$2a$10$XQxBtJXKQKQKQKQKQKQKQOxxx', name: 'Gate 2 Staff' },
];

// Allow env-based credentials: GATE_STAFF_EMAIL and GATE_STAFF_PASSWORD
function getGateStaffCredentials() {
  const envEmail = process.env.GATE_STAFF_EMAIL;
  const envPassword = process.env.GATE_STAFF_PASSWORD;
  
  if (envEmail && envPassword) {
    return { email: envEmail.toLowerCase().trim(), password: envPassword, name: 'Gate Staff' };
  }
  return null;
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
