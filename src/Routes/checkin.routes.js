import { fetchConfig, lookupRegistration, admitGuests, gateStaffLogin, gateStaffLogout, getGateStaffSession } from '../Controllers/checkin.controller.js';

function requireCheckinAuth(req, res, next) {
  // Check if user is authenticated as GATESTAFF or HITAMONLY
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  if (req.user.userType !== 'GATESTAFF' && req.user.userType !== 'HITAMONLY') {
    return res.status(403).json({
      success: false,
      error: 'Access restricted to gate staff'
    });
  }

  return next();
}

export function checkinRoutes(app) {
  // Auth endpoints (no auth required)
  app.post('/api/checkin/login', gateStaffLogin);
  app.post('/api/checkin/logout', gateStaffLogout);
  app.get('/api/checkin/session', getGateStaffSession);
  
  // Protected endpoints
  app.get('/api/checkin/config', requireCheckinAuth, fetchConfig);
  app.post('/api/checkin/lookup', requireCheckinAuth, lookupRegistration);
  app.post('/api/checkin/admit', requireCheckinAuth, admitGuests);
}
