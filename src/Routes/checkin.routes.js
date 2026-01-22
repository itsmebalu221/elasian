import { fetchConfig, lookupRegistration, admitGuests } from '../Controllers/checkin.controller.js';

function requireCheckinAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  if (req.user.userType !== 'HITAMONLY') {
    return res.status(403).json({
      success: false,
      error: 'Check-in console is restricted to HITAM staff accounts'
    });
  }

  return next();
}

export function checkinRoutes(app) {
  app.get('/api/checkin/config', requireCheckinAuth, fetchConfig);
  app.post('/api/checkin/lookup', requireCheckinAuth, lookupRegistration);
  app.post('/api/checkin/admit', requireCheckinAuth, admitGuests);
}
