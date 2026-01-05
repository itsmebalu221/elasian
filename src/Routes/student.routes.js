import { submitStudentFormHandler, getStudentFormHandler } from '../Controllers/student.controller.js';
import { getEventCatalog } from '../Controllers/event.controller.js';

export async function studentRoutes(fastify) {
  // Submit student form
  fastify.post('/api/student/form', submitStudentFormHandler);

  // Get current user's form
  fastify.get('/api/student/form', getStudentFormHandler);

  // Event catalog
  fastify.get('/api/events', getEventCatalog);
}
