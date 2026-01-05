import { externalRegistrationSchema } from '../Schemas/external.schema.js';
import * as externalService from '../Services/external.service.js';
import * as paymentService from '../Services/payment.service.js';

const REUSE_WINDOW_MINUTES = 30;

// Helper to parse selected_events JSON string to array
function parseRegistrationEvents(registration) {
  if (!registration) return registration;
  
  const parsed = { ...registration };
  if (typeof parsed.selected_events === 'string') {
    try {
      parsed.selected_events = JSON.parse(parsed.selected_events);
    } catch {
      parsed.selected_events = [];
    }
  } else if (!Array.isArray(parsed.selected_events)) {
    parsed.selected_events = [];
  }
  return parsed;
}

export async function registerExternalParticipant(req, res) {
  try {
    // Use authenticated user's email
    const userEmail = req.user?.email;
    if (!userEmail) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    // Override email with authenticated user's email for security
    const payload = {
      ...req.body,
      email: userEmail.toLowerCase().trim()
    };

    const validated = externalRegistrationSchema.parse(payload);
    const result = await externalService.createExternalRegistration(validated);

    // Parse selected_events and hide registration_id if payment is not complete
    const responseData = parseRegistrationEvents(result.record);
    if (!result.isPaid) {
      delete responseData.registration_id;
    }

    return res.json({
      success: true,
      registration: responseData,
      isExisting: result.isExisting,
      isPaid: result.isPaid
    });
  } catch (error) {
    console.error('External registration error:', error);

    if (error.name === 'ZodError') {
      const message = error.errors?.[0]?.message || 'Invalid data provided';
      return res.status(400).json({ success: false, error: message });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to register participant'
    });
  }
}

export async function createExternalOrder(req, res) {
  try {
    const { registrationId } = req.body;
    const userEmail = req.user?.email?.toLowerCase().trim();

    if (!userEmail) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!registrationId) {
      return res.status(400).json({ error: 'Registration ID is required' });
    }

    const registration = await externalService.getExternalRegistrationById(registrationId);

    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    // Verify the authenticated user owns this registration
    if (registration.email.toLowerCase().trim() !== userEmail) {
      console.warn(`Payment attempt by ${userEmail} for registration owned by ${registration.email}`);
      return res.status(403).json({ error: 'You are not authorized to pay for this registration' });
    }

    if (registration.payment_status === 'PAID') {
      return res.status(400).json({ error: 'Payment already completed for this registration' });
    }

    const existingPayment = await paymentService.getPaymentByExternalRegistrationId(registration.id);
    if (existingPayment && existingPayment.status === 'PENDING' && existingPayment.payment_session_id) {
      const createdAt = new Date(existingPayment.created_at);
      const now = new Date();
      const diffMinutes = (now - createdAt) / (1000 * 60);

      if (diffMinutes < REUSE_WINDOW_MINUTES) {
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
      externalRegistrationId: registration.id,
      customerName: registration.full_name,
      customerEmail: registration.email,
      customerPhone: registration.mobile,
      amount: registration.total_amount,
      returnUrlPath: '/payment-status.html?type=external&order_id={order_id}',
      orderNote: `Elysian 2026 External Pass - Registration ID: ${registration.registration_id}`
    });

    return res.json(result);
  } catch (error) {
    console.error('External order error:', error);
    return res.status(500).json({
      error: 'Failed to create payment order',
      message: error.message
    });
  }
}

export async function getExternalPaymentStatus(req, res) {
  try {
    const { registrationId } = req.query;
    const userEmail = req.user?.email?.toLowerCase().trim();

    if (!userEmail) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!registrationId) {
      return res.status(400).json({ error: 'Registration ID is required' });
    }

    const numericId = Number(registrationId);
    if (Number.isNaN(numericId)) {
      return res.status(400).json({ error: 'Invalid registration ID' });
    }

    const registration = await externalService.getExternalRegistrationById(numericId);

    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    // Verify the authenticated user owns this registration
    if (registration.email.toLowerCase().trim() !== userEmail) {
      return res.status(403).json({ error: 'You are not authorized to view this registration' });
    }

    const isPaid = await paymentService.isExternalRegistrationPaid(registration.id);
    const payment = await paymentService.getPaymentByExternalRegistrationId(registration.id);

    return res.json({
      isPaid,
      registration: {
        id: registration.id,
        // Only return registration code if paid
        code: isPaid ? registration.registration_id : null,
        addOnSelected: !!registration.add_on_selected,
        amount: registration.total_amount,
        paymentStatus: registration.payment_status
      },
      payment: payment
        ? {
            orderId: payment.order_id,
            status: payment.status,
            amount: payment.amount,
            paidAt: payment.paid_at
          }
        : null,
      amount: registration.total_amount
    });
  } catch (error) {
    console.error('External payment status error:', error);
    return res.status(500).json({ error: 'Failed to get payment status' });
  }
}

export async function getExternalRegistrationByEmail(req, res) {
  try {
    // Use authenticated user's email for security - ignore query param
    const email = req.user?.email;

    if (!email) {
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required' 
      });
    }

    const registration = await externalService.getExternalRegistrationByEmail(email.toLowerCase().trim());

    if (!registration) {
      return res.status(404).json({ 
        success: false,
        error: 'No registration found for this email' 
      });
    }

    // Parse selected_events and hide registration_id if payment is not complete
    const responseData = parseRegistrationEvents(registration);
    if (registration.payment_status !== 'PAID') {
      delete responseData.registration_id;
    }

    return res.json({
      success: true,
      registration: responseData
    });
  } catch (error) {
    console.error('Get external registration by email error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to fetch registration' 
    });
  }
}
