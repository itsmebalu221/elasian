import * as paymentController from '../Controllers/payment.controller.js';

export async function paymentRoutes(fastify, options) {
  // Create payment order
  fastify.post('/api/payment/create-order', paymentController.createOrder);

  // Verify payment status
  fastify.get('/api/payment/verify', paymentController.verifyPayment);

  // Get payment status for a form
  fastify.get('/api/payment/status', paymentController.getPaymentStatus);

  // Webhook endpoint (no auth required - Cashfree calls this)
  fastify.post('/api/payment/webhook', {
    config: {
      rawBody: true
    }
  }, paymentController.handleWebhook);
}
