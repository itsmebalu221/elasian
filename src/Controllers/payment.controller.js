import * as paymentService from '../Services/payment.service.js';
import { createOrderSchema, verifyPaymentSchema } from '../Schemas/payment.schema.js';
import { PAYMENT_AMOUNT } from '../config/cashfree.js';

// Create payment order
export async function createOrder(request, reply) {
  try {
    // Check if user is authenticated
    if (!request.session?.user?.id) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { formId, customerPhone } = request.body;
    const user = request.session.user;

    // Validate input
    const validated = createOrderSchema.parse({
      studentId: user.id,
      formId: formId,
      customerName: user.name,
      customerEmail: user.email,
      customerPhone: customerPhone
    });

    // Check if already paid
    const isPaid = await paymentService.isFormPaid(formId);
    if (isPaid) {
      return reply.status(400).send({ error: 'Payment already completed for this registration' });
    }

    // Check for existing pending payment
    const existingPayment = await paymentService.getPaymentByFormId(formId);
    if (existingPayment && existingPayment.status === 'PENDING') {
      // Return existing session if still valid (created within last 30 minutes)
      const createdAt = new Date(existingPayment.created_at);
      const now = new Date();
      const diffMinutes = (now - createdAt) / (1000 * 60);
      
      if (diffMinutes < 30 && existingPayment.payment_session_id) {
        return reply.send({
          success: true,
          orderId: existingPayment.order_id,
          paymentSessionId: existingPayment.payment_session_id,
          orderAmount: existingPayment.amount,
          message: 'Using existing payment session'
        });
      }
    }

    const result = await paymentService.createPaymentOrder(
      validated.studentId,
      validated.formId,
      validated.customerName,
      validated.customerEmail,
      validated.customerPhone
    );

    return reply.send(result);
  } catch (error) {
    console.error('Create order error:', error);
    return reply.status(500).send({ 
      error: 'Failed to create payment order',
      message: error.message 
    });
  }
}

// Verify payment status
export async function verifyPayment(request, reply) {
  try {
    const { orderId } = request.query;

    if (!orderId) {
      return reply.status(400).send({ error: 'Order ID is required' });
    }

    const result = await paymentService.verifyPaymentStatus(orderId);
    return reply.send(result);
  } catch (error) {
    console.error('Verify payment error:', error);
    return reply.status(500).send({ 
      error: 'Failed to verify payment',
      message: error.message 
    });
  }
}

// Webhook handler
export async function handleWebhook(request, reply) {
  try {
    const signature = request.headers['x-webhook-signature'];
    const payload = request.body;

    const result = await paymentService.handleWebhook(payload, signature);
    return reply.send(result);
  } catch (error) {
    console.error('Webhook error:', error);
    return reply.status(500).send({ error: 'Webhook processing failed' });
  }
}

// Get payment status for current user's form
export async function getPaymentStatus(request, reply) {
  try {
    if (!request.session?.user?.id) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { formId } = request.query;

    if (!formId) {
      return reply.status(400).send({ error: 'Form ID is required' });
    }

    const payment = await paymentService.getPaymentByFormId(parseInt(formId));
    const isPaid = await paymentService.isFormPaid(parseInt(formId));

    return reply.send({
      isPaid,
      payment: payment ? {
        orderId: payment.order_id,
        status: payment.status,
        amount: payment.amount,
        paidAt: payment.paid_at
      } : null,
      amount: PAYMENT_AMOUNT
    });
  } catch (error) {
    console.error('Get payment status error:', error);
    return reply.status(500).send({ error: 'Failed to get payment status' });
  }
}
