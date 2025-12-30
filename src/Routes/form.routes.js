import { submitForm } from '../Controllers/form.controller.js';

export async function formRoutes(fastify) {
  fastify.post('/submit', submitForm);
}
