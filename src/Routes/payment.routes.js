import * as paymentController from '../Controllers/payment.controller.js';

export function paymentRoutes(app) {
  app.post('/api/payment/create-order', paymentController.createOrder);
  app.get('/api/payment/verify', paymentController.verifyPayment);
  app.get('/api/payment/status', paymentController.getPaymentStatus);
  app.post('/api/payment/webhook', paymentController.handleWebhook);
}
