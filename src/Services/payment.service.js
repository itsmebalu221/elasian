import { PAYMENT_AMOUNT, CASHFREE_MODE, createOrderDirect } from '../config/cashfree.js';
import db from '../db/mysql.js';
import crypto from 'crypto';
import { sendConfirmationForPayment } from './email.service.js';

// Generate unique order ID
function generateOrderId() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `ELY26_${timestamp}_${random}`.toUpperCase();
}

const CASHFREE_API_BASE = CASHFREE_MODE === 'production'
  ? 'https://api.cashfree.com/pg'
  : 'https://sandbox.cashfree.com/pg';

async function fetchCashfreeOrderPayments(orderId) {
  const response = await fetch(`${CASHFREE_API_BASE}/orders/${orderId}/payments`, {
    method: 'GET',
    headers: {
      'x-api-version': '2023-08-01',
      'x-client-id': process.env.CASHFREE_APP_ID || '',
      'x-client-secret': process.env.CASHFREE_SECRET_KEY || ''
    }
  });

  let rawText = '';
  try {
    rawText = await response.text();
  } catch (err) {
    rawText = '';
  }

  let parsedBody;
  if (rawText) {
    try {
      parsedBody = JSON.parse(rawText);
    } catch (err) {
      parsedBody = { parseError: err.message, raw: rawText };
    }
  }

  if (!response.ok) {
    const error = new Error('Failed to fetch payment status from Cashfree');
    error.response = {
      status: response.status,
      data: parsedBody || rawText
    };
    throw error;
  }

  console.log('Cashfree payment fetch', {
    orderId,
    status: response.status,
    bodyType: parsedBody ? typeof parsedBody : 'empty',
    hasPaymentsArray: Array.isArray(parsedBody?.payments) || Array.isArray(parsedBody)
  });

  if (Array.isArray(parsedBody)) {
    return parsedBody;
  }

  if (parsedBody && Array.isArray(parsedBody.data)) {
    return parsedBody.data;
  }

  if (parsedBody && Array.isArray(parsedBody.payments)) {
    return parsedBody.payments;
  }

  return [];
}

// Create payment order
export async function createPaymentOrder({
  studentId = null,
  formId = null,
  externalRegistrationId = null,
  customerName,
  customerEmail,
  customerPhone,
  amount = PAYMENT_AMOUNT,
  returnUrlPath = '/payment-status.html?order_id={order_id}',
  notifyPath = '/api/payment/webhook',
  orderNote
}) {
  const orderId = generateOrderId();
  
  // Determine base URL - prioritize APP_URL env var, then detect from VERCEL_URL, fallback to localhost
  let baseUrl = process.env.APP_URL;
  if (!baseUrl) {
    // For Vercel deployments
    if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else if (process.env.NODE_ENV === 'production') {
      // Hardcoded fallback for production
      baseUrl = 'https://elysianhitam.com';
    } else {
      baseUrl = 'http://localhost:3000';
    }
  }
  
  // Debug: Log environment variables
  console.log('Payment Service - Environment Check:', {
    APP_URL: process.env.APP_URL,
    VERCEL_URL: process.env.VERCEL_URL,
    NODE_ENV: process.env.NODE_ENV,
    CASHFREE_ENV: process.env.CASHFREE_ENV,
    resolvedBaseUrl: baseUrl
  });

  try {
    const orderRequest = {
      order_id: orderId,
      order_amount: amount,
      order_currency: 'INR',
      customer_details: {
        customer_id: studentId
          ? `STU_${studentId}`
          : externalRegistrationId
            ? `EXT_${externalRegistrationId}`
            : `GUEST_${Date.now()}`,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone
      },
      order_meta: {
        return_url: `${baseUrl}${returnUrlPath}`,
        notify_url: `${baseUrl}${notifyPath}`
      },
      order_note: orderNote
        || (formId
          ? `Elysian 2026 Event Pass - Form ID: ${formId}`
          : externalRegistrationId
            ? `Elysian 2026 External Pass - Registration ID: ${externalRegistrationId}`
            : 'Elysian 2026 Payment')
    };

    console.log('Creating Cashfree order:', JSON.stringify(orderRequest, null, 2));
    
    // Use direct API call instead of SDK (for debugging 401 issues)
    const response = await createOrderDirect(orderRequest);

    console.log('Cashfree response:', JSON.stringify(response.data, null, 2));

    if (response.data) {
      await db.query(`
        INSERT INTO payments (
          order_id,
          student_id,
          form_id,
          external_registration_id,
          amount,
          status,
          cf_order_id,
          payment_session_id,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, NOW())
      `,
      [
        orderId,
        studentId,
        formId,
        externalRegistrationId,
        amount,
        response.data.cf_order_id,
        response.data.payment_session_id
      ]);

      return {
        success: true,
        orderId,
        cfOrderId: response.data.cf_order_id,
        paymentSessionId: response.data.payment_session_id,
        orderAmount: amount,
        mode: CASHFREE_MODE
      };
    }

    throw new Error('Failed to create order');
  } catch (error) {
    console.error('Payment order creation error:', error);
    throw error;
  }
}

export function getCashfreeMode() {
  return CASHFREE_MODE;
}

// Verify payment status
export async function verifyPaymentStatus(orderId) {
  try {
    // Get payment from database
    const [payments] = await db.query(
      'SELECT * FROM payments WHERE order_id = ?',
      [orderId]
    );

    if (payments.length === 0) {
      throw new Error('Payment not found');
    }

    const payment = payments[0];
    const isExternal = !!payment.external_registration_id;
    const context = isExternal ? 'EXTERNAL' : 'HITAMONLY';

    let registrationCode = null;
    if (payment.form_id) {
      const [forms] = await db.query(
        'SELECT registration_id FROM student_forms WHERE id = ?',
        [payment.form_id]
      );
      registrationCode = forms[0]?.registration_id || null;
    } else if (isExternal) {
      const [externals] = await db.query(
        'SELECT registration_id FROM external_registrations WHERE id = ?',
        [payment.external_registration_id]
      );
      registrationCode = externals[0]?.registration_id || null;
    }

    // If already successful, return cached status
    if (payment.status === 'SUCCESS') {
      return {
        success: true,
        status: 'SUCCESS',
        orderId: payment.order_id,
        amount: payment.amount,
        paidAt: payment.paid_at,
        paymentMethod: payment.payment_method,
        context,
        registrationCode
      };
    }

    // Fetch latest status from Cashfree via REST API to avoid SDK inconsistencies
    const payments = await fetchCashfreeOrderPayments(orderId);

    if (payments.length > 0) {
      const latestPayment = payments[0];
      const paymentMethod = latestPayment.payment_group || latestPayment.payment_method || payment.payment_method || null;
      
      if (latestPayment.payment_status === 'SUCCESS') {
        // Update database
        await db.query(`
          UPDATE payments 
          SET status = 'SUCCESS', 
              cf_payment_id = ?,
              payment_method = ?,
              paid_at = NOW(),
              updated_at = NOW()
          WHERE order_id = ?
        `, [latestPayment.cf_payment_id, paymentMethod, orderId]);

        if (payment.form_id) {
          await db.query(`
            UPDATE student_forms 
            SET payment_status = 'PAID', payment_id = ?
            WHERE id = ?
          `, [payment.id, payment.form_id]);
        } else if (isExternal) {
          await db.query(`
            UPDATE external_registrations
            SET payment_status = 'PAID', payment_id = ?, updated_at = NOW()
            WHERE id = ?
          `, [payment.id, payment.external_registration_id]);
        }

        // Send confirmation email (async, don't block response)
        sendConfirmationForPayment(orderId).catch(err => {
          console.error('Failed to send confirmation email:', err);
        });

        return {
          success: true,
          status: 'SUCCESS',
          orderId,
          amount: payment.amount,
          paymentMethod,
          context,
          registrationCode
        };
      } else if (latestPayment.payment_status === 'FAILED') {
        await db.query(`
          UPDATE payments SET status = 'FAILED', updated_at = NOW() WHERE order_id = ?
        `, [orderId]);

        if (payment.form_id) {
          await db.query(`
            UPDATE student_forms SET payment_status = 'FAILED', updated_at = NOW() WHERE id = ?
          `, [payment.form_id]);
        } else if (isExternal) {
          await db.query(`
            UPDATE external_registrations SET payment_status = 'FAILED', updated_at = NOW() WHERE id = ?
          `, [payment.external_registration_id]);
        }

        return {
          success: false,
          status: 'FAILED',
          orderId,
          message: latestPayment.payment_message || latestPayment.error_message || 'Payment failed',
          context,
          registrationCode: null  // Don't reveal on failed payment
        };
      }
    }

    return {
      success: false,
      status: payment.status,
      orderId,
      message: 'Payment pending or not completed',
      context,
      registrationCode: null  // Don't reveal on pending payment
    };
  } catch (error) {
    console.error('Payment verification error:', error);
    throw error;
  }
}

// Handle webhook from Cashfree
export async function handleWebhook(payload, signature) {
  try {
    const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
    
    // Verify webhook signature in production
    if (isProduction && process.env.CASHFREE_SECRET_KEY) {
      const timestamp = payload.data?.payment?.payment_time || '';
      const body = JSON.stringify(payload);
      
      const expectedSignature = crypto
        .createHmac('sha256', process.env.CASHFREE_SECRET_KEY)
        .update(timestamp + body)
        .digest('base64');

      if (signature !== expectedSignature) {
        console.warn('Webhook signature verification failed');
        throw new Error('Invalid webhook signature');
      }
    }

    const eventType = payload.type;
    const orderData = payload.data?.order;
    const paymentData = payload.data?.payment;

    if (!orderData) {
      return { success: false, message: 'No order data in webhook' };
    }

    const orderId = orderData.order_id;

    if (eventType === 'PAYMENT_SUCCESS_WEBHOOK') {
      await db.query(`
        UPDATE payments 
        SET status = 'SUCCESS', 
            cf_payment_id = ?,
            payment_method = ?,
            paid_at = NOW(),
            updated_at = NOW()
        WHERE order_id = ?
      `, [paymentData?.cf_payment_id, paymentData?.payment_group || paymentData?.payment_method || null, orderId]);

      const [payments] = await db.query(
        'SELECT form_id, external_registration_id, id FROM payments WHERE order_id = ?',
        [orderId]
      );

      if (payments.length > 0) {
        const payment = payments[0];

        if (payment.form_id) {
          await db.query(`
            UPDATE student_forms 
            SET payment_status = 'PAID', payment_id = ?
            WHERE id = ?
          `, [payment.id, payment.form_id]);
        } else if (payment.external_registration_id) {
          await db.query(`
            UPDATE external_registrations
            SET payment_status = 'PAID', payment_id = ?, updated_at = NOW()
            WHERE id = ?
          `, [payment.id, payment.external_registration_id]);
        }

        // Send confirmation email (async, don't block webhook response)
        sendConfirmationForPayment(orderId).catch(err => {
          console.error('Failed to send confirmation email from webhook:', err);
        });
      }

      console.log(`✅ Payment successful for order: ${orderId}`);
    } else if (eventType === 'PAYMENT_FAILED_WEBHOOK') {
      await db.query(`
        UPDATE payments SET status = 'FAILED', updated_at = NOW() WHERE order_id = ?
      `, [orderId]);

      const [payments] = await db.query(
        'SELECT form_id, external_registration_id FROM payments WHERE order_id = ?',
        [orderId]
      );

      if (payments.length > 0) {
        const payment = payments[0];

        if (payment.form_id) {
          await db.query(`
            UPDATE student_forms SET payment_status = 'FAILED', updated_at = NOW() WHERE id = ?
          `, [payment.form_id]);
        } else if (payment.external_registration_id) {
          await db.query(`
            UPDATE external_registrations SET payment_status = 'FAILED', updated_at = NOW() WHERE id = ?
          `, [payment.external_registration_id]);
        }
      }
      
      console.log(`❌ Payment failed for order: ${orderId}`);
    }

    return { success: true, message: 'Webhook processed' };
  } catch (error) {
    console.error('Webhook processing error:', error);
    throw error;
  }
}

// Get payment by form ID
export async function getPaymentByFormId(formId) {
  const [payments] = await db.query(
    'SELECT * FROM payments WHERE form_id = ? ORDER BY created_at DESC LIMIT 1',
    [formId]
  );
  return payments[0] || null;
}

// Check if form is paid
export async function isFormPaid(formId) {
  const [forms] = await db.query(
    'SELECT payment_status FROM student_forms WHERE id = ?',
    [formId]
  );
  return forms[0]?.payment_status === 'PAID';
}

export async function getPaymentByExternalRegistrationId(externalRegistrationId) {
  const [payments] = await db.query(
    'SELECT * FROM payments WHERE external_registration_id = ? ORDER BY created_at DESC LIMIT 1',
    [externalRegistrationId]
  );
  return payments[0] || null;
}

export async function isExternalRegistrationPaid(externalRegistrationId) {
  const [rows] = await db.query(
    'SELECT payment_status FROM external_registrations WHERE id = ?',
    [externalRegistrationId]
  );
  return rows[0]?.payment_status === 'PAID';
}

// Verify that a form belongs to a specific student
export async function verifyFormOwnership(formId, studentId) {
  const [forms] = await db.query(
    'SELECT id, student_id FROM student_forms WHERE id = ?',
    [formId]
  );
  
  if (forms.length === 0) {
    return { valid: false, reason: 'Form not found' };
  }
  
  if (forms[0].student_id !== studentId) {
    return { valid: false, reason: 'Form belongs to another user' };
  }
  
  return { valid: true };
}

// Verify that a payment belongs to a specific user (by student_id or email for external)
export async function verifyPaymentOwnership(orderId, studentId, email) {
  const [payments] = await db.query(
    'SELECT student_id, external_registration_id FROM payments WHERE order_id = ?',
    [orderId]
  );
  
  if (payments.length === 0) {
    return false;
  }
  
  const payment = payments[0];
  
  // Check if it's an internal payment
  if (payment.student_id) {
    return payment.student_id === studentId;
  }
  
  // Check if it's an external payment
  if (payment.external_registration_id && email) {
    const [externals] = await db.query(
      'SELECT email FROM external_registrations WHERE id = ?',
      [payment.external_registration_id]
    );
    return externals[0]?.email?.toLowerCase() === email?.toLowerCase();
  }
  
  return false;
}
