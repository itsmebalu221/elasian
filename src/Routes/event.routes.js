import { getEventCatalog } from '../Controllers/event.controller.js';

export function eventRoutes(app) {
  app.get('/api/events/catalog', getEventCatalog);
}
