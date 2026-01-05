import { submitStudentFormHandler, getStudentFormHandler } from '../Controllers/student.controller.js';
import { getEventCatalog } from '../Controllers/event.controller.js';

export function studentRoutes(app) {
  app.post('/api/student/form', submitStudentFormHandler);
  app.get('/api/student/form', getStudentFormHandler);
  app.get('/api/events', getEventCatalog);
}
