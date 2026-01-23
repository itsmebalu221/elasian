import { sendBulkQrEmails, sendButterflyEmailsByCode } from '../Controllers/admin.controller.js';

export function adminRoutes(app) {
  app.get('/api/admin/email/qr-bulk', sendBulkQrEmails);
  app.post('/api/admin/email/qr-bulk', sendBulkQrEmails);
  app.get('/api/admin/email/butterfly', sendButterflyEmailsByCode);
  app.post('/api/admin/email/butterfly', sendButterflyEmailsByCode);
}
