import * as paymentService from '../Services/payment.service.js';
import { createOrderSchema } from '../Schemas/payment.schema.js';
import { PAYMENT_AMOUNT } from '../config/cashfree.js';

export async function createOrder(req, res) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { formId, customerPhone } = req.body;
    const user = req.user;

    const validated = createOrderSchema.parse({
      studentId: user.id,
      formId,
      customerName: user.name,
      customerEmail: user.email,
      customerPhone
    });

    // Verify the form belongs to this user
    const formOwnership = await paymentService.verifyFormOwnership(formId, user.id);
    if (!formOwnership.valid) {
      return res.status(403).json({ error: 'You are not authorized to pay for this registration' });
    }

    const isPaid = await paymentService.isFormPaid(formId);
    if (isPaid) {
      return res.status(400).json({ error: 'Payment already completed for this registration' });
    }

    const existingPayment = await paymentService.getPaymentByFormId(formId);
    if (existingPayment && existingPayment.status === 'PENDING') {
      const createdAt = new Date(existingPayment.created_at);
      const now = new Date();
      const diffMinutes = (now - createdAt) / (1000 * 60);

      if (diffMinutes < 30 && existingPayment.payment_session_id) {
        return res.json({
          success: true,
          orderId: existingPayment.order_id,
          paymentSessionId: existingPayment.payment_session_id,
          orderAmount: existingPayment.amount,
          message: 'Using existing payment session'
        });
      }
    }

    const result = await paymentService.createPaymentOrder({
      studentId: validated.studentId,
      formId: validated.formId,
      customerName: validated.customerName,
      customerEmail: validated.customerEmail,
      customerPhone: validated.customerPhone
    });

    return res.json(result);
  } catch (error) {
    console.error('Create order error:', error);
    return res.status(500).json({
      error: 'Failed to create payment order',
      message: error.message
    });
  }
}

export async function verifyPayment(req, res) {
  try {
    const { orderId } = req.query;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    // Verify ownership if user is authenticated
    if (req.user?.id) {
      const ownershipValid = await paymentService.verifyPaymentOwnership(orderId, req.user.id, req.user.email);
      if (!ownershipValid) {
        return res.status(403).json({ error: 'You are not authorized to view this payment' });
      }
    }

    const result = await paymentService.verifyPaymentStatus(orderId);
    return res.json(result);
  } catch (error) {
    console.error('Verify payment error:', error);
    return res.status(500).json({
      error: 'Failed to verify payment',
      message: error.message
    });
  }
}

export async function handleWebhook(req, res) {
  try {
    const signature = req.headers['x-webhook-signature'];
    const payload = req.body;

    const result = await paymentService.handleWebhook(payload, signature);
    return res.json(result);
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}

export async function getPaymentStatus(req, res) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { formId } = req.query;

    if (!formId) {
      return res.status(400).json({ error: 'Form ID is required' });
    }

    const numericFormId = parseInt(formId, 10);

    // Verify the form belongs to this user
    const formOwnership = await paymentService.verifyFormOwnership(numericFormId, req.user.id);
    if (!formOwnership.valid) {
      return res.status(403).json({ error: 'You are not authorized to view this payment status' });
    }

    const payment = await paymentService.getPaymentByFormId(numericFormId);
    const isPaid = await paymentService.isFormPaid(numericFormId);

    return res.json({
      isPaid,
      payment: payment
        ? {
            orderId: payment.order_id,
            status: payment.status,
            amount: payment.amount,
            paidAt: payment.paid_at
          }
        : null,
      amount: PAYMENT_AMOUNT
    });
  } catch (error) {
    console.error('Get payment status error:', error);
    return res.status(500).json({ error: 'Failed to get payment status' });
  }
}
