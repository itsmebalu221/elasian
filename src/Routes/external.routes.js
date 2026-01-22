import * as externalController from '../Controllers/external.controller.js';
import { verifyToken, getCookieName } from '../utils/jwt.js';

// Authentication middleware for external routes
function requireExternalAuth(req, res, next) {
  try {
    const token = req.cookies?.[getCookieName()];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please login first.'
      });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session. Please login again.'
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error('External auth error:', error);
    return res.status(401).json({
      success: false,
      error: 'Authentication failed.'
    });
  }
}

export function externalRoutes(app) {
  // All external routes require authentication
  app.post('/api/external/register', requireExternalAuth, externalController.registerExternalParticipant);
  app.post('/api/external/payment/create-order', requireExternalAuth, externalController.createExternalOrder);
  app.get('/api/external/payment/status', requireExternalAuth, externalController.getExternalPaymentStatus);
  app.get('/api/external/registration/by-email', requireExternalAuth, externalController.getExternalRegistrationByEmail);
  app.get('/api/external/registration/:identityNumber', requireExternalAuth, externalController.getRegistrationByIdentity);
  app.get('/api/external/registration/code/:elysianId', requireExternalAuth, externalController.getRegistrationByElysianId);
}
