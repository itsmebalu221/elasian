import { fetchConfig, lookupRegistration, admitGuests } from '../Controllers/checkin.controller.js';

function requireCheckinAuth(req, res, next) {
  // Allow unauthenticated access for now (testing)
  // TODO: Re-enable auth in production
  if (!req.user) {
    req.user = { email: 'gate-staff@test.local' }; // Mock user for testing
    return next();
  }

  // Skip userType check for now
  // if (req.user.userType !== 'HITAMONLY') {
  //   return res.status(403).json({
  //     success: false,
  //     error: 'Check-in console is restricted to HITAM staff accounts'
  //   });
  // }

  return next();
}

export function checkinRoutes(app) {
  app.get('/api/checkin/config', requireCheckinAuth, fetchConfig);
  app.post('/api/checkin/lookup', requireCheckinAuth, lookupRegistration);
  app.post('/api/checkin/admit', requireCheckinAuth, admitGuests);
}
