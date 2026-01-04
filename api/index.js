import fastify from '../server.js';

export default async function handler(req, res) {
  try {
    await fastify.ready();
    fastify.server.emit('request', req, res);
  } catch (error) {
    console.error('Vercel handler error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
