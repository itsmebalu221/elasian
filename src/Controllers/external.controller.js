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
    // Use authenticated email when available, otherwise accept payload email
    const userEmail = req.user?.email;
    const fallbackEmail = req.body?.email;
    const resolvedEmail = (userEmail || fallbackEmail || '').toString().toLowerCase().trim();

    if (!resolvedEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Override email with authenticated user's email for security when present
    const payload = {
      ...req.body,
      email: resolvedEmail
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
          mode: paymentService.getCashfreeMode(),
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

    // Extract detailed error info for debugging
    let errorDetails = {
      message: error.message,
      code: error.code || 'UNKNOWN',
      name: error.name
    };

    // Cashfree API errors have response data
    if (error.response?.data) {
      errorDetails.cashfreeError = error.response.data;
    }

    // Axios errors have response info
    if (error.response) {
      errorDetails.statusCode = error.response.status;
      errorDetails.statusText = error.response.statusText;
    }

    // Stack trace for debugging (only first 500 chars)
    if (error.stack) {
      errorDetails.stack = error.stack.substring(0, 500);
    }

    return res.status(500).json({
      error: 'Failed to create payment order',
      message: error.message,
      details: errorDetails
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

    // Parse other JSON fields (same logic as identity search)
    const jsonFields = [
      'esparto_team_members', 'sahitya_team_members', 'prasasti_team_members',
      'esparto_events', 'sahitya_events', 'prasasti_events'
    ];

    jsonFields.forEach(field => {
      if (responseData[field] && typeof responseData[field] === 'string') {
        try {
          responseData[field] = JSON.parse(responseData[field]);
        } catch (e) {
          console.warn(`Failed to parse ${field}:`, e);
          responseData[field] = [];
        }
      }
    });

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
export async function getRegistrationByIdentity(req, res) {
  try {
    const { identityNumber } = req.params;

    if (!identityNumber) {
      return res.status(400).json({
        success: false,
        error: 'Identity number is required'
      });
    }

    const registration = await externalService.getExternalRegistrationByIdentity(identityNumber);

    if (!registration) {
      return res.status(404).json({
        success: false,
        error: 'No registration found for this Identity Number'
      });
    }

    // Parse specific JSON fields for the frontend
    const responseData = parseRegistrationEvents(registration);

    // Ideally mysql2 handles JSON columns, but for safety ensuring they are objects
    const jsonFields = [
      'esparto_team_members', 'sahitya_team_members', 'prasasti_team_members',
      'esparto_events', 'sahitya_events', 'prasasti_events'
    ];

    jsonFields.forEach(field => {
      if (responseData[field] && typeof responseData[field] === 'string') {
        try {
          responseData[field] = JSON.parse(responseData[field]);
        } catch (e) {
          console.warn(`Failed to parse ${field}:`, e);
          responseData[field] = [];
        }
      }
    });

    return res.json({
      success: true,
      registration: responseData,
      isPaid: registration.payment_status === 'PAID'
    });
  } catch (error) {
    console.error('Get registration by identity error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch registration details'
    });
  }
}

export async function getRegistrationByElysianId(req, res) {
  try {
    const { elysianId } = req.params;

    if (!elysianId) {
      return res.status(400).json({
        success: false,
        error: 'Elysian ID is required'
      });
    }

    const formattedId = elysianId.trim().toUpperCase();
    const registration = await externalService.getExternalRegistrationByCode(formattedId);

    if (!registration) {
      return res.status(404).json({
        success: false,
        error: 'No registration found for this Elysian ID'
      });
    }

    const responseData = parseRegistrationEvents(registration);
    const jsonFields = [
      'esparto_team_members', 'sahitya_team_members', 'prasasti_team_members',
      'esparto_events', 'sahitya_events', 'prasasti_events'
    ];

    jsonFields.forEach(field => {
      if (responseData[field] && typeof responseData[field] === 'string') {
        try {
          responseData[field] = JSON.parse(responseData[field]);
        } catch (e) {
          console.warn(`Failed to parse ${field}:`, e);
          responseData[field] = [];
        }
      }
    });

    return res.json({
      success: true,
      registration: responseData,
      isPaid: registration.payment_status === 'PAID'
    });
  } catch (error) {
    console.error('Get registration by Elysian ID error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch registration details'
    });
  }
}
