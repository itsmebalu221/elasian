import * as butterflyController from '../Controllers/butterfly.controller.js';
import { verifyToken, getCookieName } from '../utils/jwt.js';

// Authentication middleware for butterfly routes
// Uses req.user populated by server middleware, with fallback to direct cookie check
function requireButterflyAuth(req, res, next) {
    try {
        // Debug logging
        console.log('🦋 Butterfly Auth Check:', {
            hasReqUser: !!req.user,
            userEmail: req.user?.email || 'none',
            cookiesPresent: Object.keys(req.cookies || {})
        });

        // First check if server middleware already populated req.user
        if (req.user && req.user.email) {
            console.log('🦋 Auth OK - Using existing req.user');
            return next();
        }

        // Fallback: Try to get token from cookie directly
        const cookieName = getCookieName();
        const token = req.cookies?.[cookieName];

        if (!token) {
            console.log('🦋 Auth FAILED - No token in cookies');
            return res.status(401).json({
                success: false,
                error: 'Authentication required. Please login first.'
            });
        }

        // Verify the token
        const decoded = verifyToken(token);
        if (!decoded) {
            console.log('🦋 Auth FAILED - Token verification failed');
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired session. Please login again.'
            });
        }

        // Set req.user from decoded token
        req.user = decoded;
        console.log('🦋 Auth OK - Token verified, user set');
        next();
    } catch (error) {
        console.error('🦋 Butterfly auth error:', error.message);
        return res.status(401).json({
            success: false,
            error: 'Authentication failed. Please try logging in again.'
        });
    }
}

export function butterflyRoutes(app) {
    // All butterfly routes require authentication
    app.post('/api/butterfly/register', requireButterflyAuth, butterflyController.registerButterflyOffer);
    app.post('/api/butterfly/payment/create-order', requireButterflyAuth, butterflyController.createButterflyOrder);
    app.get('/api/butterfly/payment/status', requireButterflyAuth, butterflyController.getButterflyPaymentStatus);
    app.get('/api/butterfly/qr-codes', requireButterflyAuth, butterflyController.getButterflyQRCodes);
    app.get('/api/butterfly/registration/by-email', requireButterflyAuth, butterflyController.getButterflyRegistrationByEmail);
}
