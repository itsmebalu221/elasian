import { EVENT_DEFINITIONS, EVENT_TYPES } from '../config/events.config.js';

export async function getEventCatalog(req, res) {
  return res.json({
    success: true,
    events: EVENT_DEFINITIONS,
    types: EVENT_TYPES
  });
}
