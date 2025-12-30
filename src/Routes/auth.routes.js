import { firebaseLoginHandler, getCurrentUser, logoutHandler, logoutApiHandler, checkAuthStatus } from '../Controllers/auth.controller.js';

export async function authRoutes(fastify) {
  // Firebase login - verify and create session
  fastify.post('/api/auth/firebase-login', firebaseLoginHandler);

  // Get current user
  fastify.get('/api/auth/me', getCurrentUser);

  // Check auth status
  fastify.get('/api/auth/status', checkAuthStatus);

  // Logout (redirect)
  fastify.get('/auth/logout', logoutHandler);

  // Logout API
  fastify.post('/api/auth/logout', logoutApiHandler);
}
