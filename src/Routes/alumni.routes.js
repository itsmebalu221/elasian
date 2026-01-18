import * as alumniController from '../Controllers/alumni.controller.js';
import { verifyToken, getCookieName } from '../utils/jwt.js';

// Authentication middleware for alumni routes
function requireAlumniAuth(req, res, next) {
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
        console.error('Alumni auth error:', error);
        return res.status(401).json({
            success: false,
            error: 'Authentication failed.'
        });
    }
}

export function alumniRoutes(app) {
    // All alumni routes require authentication
    app.post('/api/alumni/register', requireAlumniAuth, alumniController.registerAlumni);
    app.post('/api/alumni/payment/create-order', requireAlumniAuth, alumniController.createAlumniOrder);
    app.get('/api/alumni/payment/status', requireAlumniAuth, alumniController.getAlumniPaymentStatus);
    app.get('/api/alumni/registration/by-email', requireAlumniAuth, alumniController.getAlumniRegistrationByEmail);
}
