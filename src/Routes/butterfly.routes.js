import * as butterflyController from '../Controllers/butterfly.controller.js';
import { verifyToken, getCookieName } from '../utils/jwt.js';

// Authentication middleware for butterfly routes
function requireButterflyAuth(req, res, next) {
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
        console.error('Butterfly auth error:', error);
        return res.status(401).json({
            success: false,
            error: 'Authentication failed.'
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
