import { EVENT_DEFINITIONS, EVENT_TYPES } from '../config/events.config.js';

export async function getEventCatalog(request, reply) {
  return reply.send({
    success: true,
    events: EVENT_DEFINITIONS,
    types: EVENT_TYPES
  });
}
