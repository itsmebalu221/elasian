import { submitForm } from '../Controllers/form.controller.js';

export function formRoutes(app) {
  app.post('/submit', submitForm);
}
