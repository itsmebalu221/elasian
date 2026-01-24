import { submitForm, lookupPassByEmail } from '../Controllers/form.controller.js';

export function formRoutes(app) {
  app.post('/submit', submitForm);
  // Public pass lookup by email
  app.post('/api/pass/lookup', lookupPassByEmail);
}
