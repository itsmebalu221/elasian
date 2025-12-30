import { submitStudentFormHandler, getStudentFormHandler } from '../Controllers/student.controller.js';

export async function studentRoutes(fastify) {
  // Submit student form
  fastify.post('/api/student/form', submitStudentFormHandler);

  // Get current user's form
  fastify.get('/api/student/form', getStudentFormHandler);
}
