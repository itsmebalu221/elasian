import { firebaseLoginHandler, getCurrentUser, logoutHandler, logoutApiHandler, checkAuthStatus } from '../Controllers/auth.controller.js';

export function authRoutes(app) {
  app.post('/api/auth/firebase-login', firebaseLoginHandler);
  app.get('/api/auth/me', getCurrentUser);
  app.get('/api/auth/status', checkAuthStatus);
  app.get('/auth/logout', logoutHandler);
  app.post('/api/auth/logout', logoutApiHandler);
}
