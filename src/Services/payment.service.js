import { Cashfree, PAYMENT_AMOUNT } from '../config/cashfree.js';
import db from '../db/mysql.js';
import crypto from 'crypto';

// Generate unique order ID
function generateOrderId() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `ELY26_${timestamp}_${random}`.toUpperCase();
}

// Create payment order
export async function createPaymentOrder(studentId, formId, customerName, customerEmail, customerPhone) {
  const orderId = generateOrderId();
  
  try {
    // Create order in Cashfree
    const orderRequest = {
      order_id: orderId,
      order_amount: PAYMENT_AMOUNT,
      order_currency: 'INR',
      customer_details: {
        customer_id: `STU_${studentId}`,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone
      },
      order_meta: {
        return_url: `${process.env.APP_URL || 'http://localhost:3000'}/payment-status.html?order_id={order_id}`,
        notify_url: `${process.env.APP_URL || 'http://localhost:3000'}/api/payment/webhook`
      },
      order_note: `Elysian 2026 Event Pass - Form ID: ${formId}`
    };

    const response = await Cashfree.PGCreateOrder(orderRequest);
    
    if (response.data) {
      // Store payment record in database
      await db.query(`
        INSERT INTO payments (order_id, student_id, form_id, amount, status, cf_order_id, payment_session_id, created_at)
        VALUES (?, ?, ?, ?, 'PENDING', ?, ?, NOW())
      `, [orderId, studentId, formId, PAYMENT_AMOUNT, response.data.cf_order_id, response.data.payment_session_id]);

      return {
        success: true,
        orderId: orderId,
        cfOrderId: response.data.cf_order_id,
        paymentSessionId: response.data.payment_session_id,
        orderAmount: PAYMENT_AMOUNT
      };
    }
    
    throw new Error('Failed to create order');
  } catch (error) {
    console.error('Payment order creation error:', error);
    throw error;
  }
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

    // If already successful, return cached status
    if (payment.status === 'SUCCESS') {
      return {
        success: true,
        status: 'SUCCESS',
        orderId: payment.order_id,
        amount: payment.amount,
        paidAt: payment.paid_at
      };
    }

    // Fetch latest status from Cashfree
    const response = await Cashfree.PGOrderFetchPayments(orderId);
    
    if (response.data && response.data.length > 0) {
      const latestPayment = response.data[0];
      
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
        `, [latestPayment.cf_payment_id, latestPayment.payment_group, orderId]);

        // Mark form as paid
        await db.query(`
          UPDATE student_forms 
          SET payment_status = 'PAID', payment_id = ?
          WHERE id = ?
        `, [payment.id, payment.form_id]);

        return {
          success: true,
          status: 'SUCCESS',
          orderId: orderId,
          amount: payment.amount,
          paymentMethod: latestPayment.payment_group
        };
      } else if (latestPayment.payment_status === 'FAILED') {
        await db.query(`
          UPDATE payments SET status = 'FAILED', updated_at = NOW() WHERE order_id = ?
        `, [orderId]);

        return {
          success: false,
          status: 'FAILED',
          orderId: orderId,
          message: latestPayment.payment_message || 'Payment failed'
        };
      }
    }

    return {
      success: false,
      status: payment.status,
      orderId: orderId,
      message: 'Payment pending or not completed'
    };
  } catch (error) {
    console.error('Payment verification error:', error);
    throw error;
  }
}

// Handle webhook from Cashfree
export async function handleWebhook(payload, signature) {
  try {
    // Verify webhook signature
    const timestamp = payload.data?.payment?.payment_time || Date.now().toString();
    const body = JSON.stringify(payload);
    
    const expectedSignature = crypto
      .createHmac('sha256', process.env.CASHFREE_SECRET_KEY)
      .update(timestamp + body)
      .digest('base64');

    // For production, verify signature strictly
    // if (signature !== expectedSignature) {
    //   throw new Error('Invalid webhook signature');
    // }

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
      `, [paymentData?.cf_payment_id, paymentData?.payment_group, orderId]);

      // Get payment to update form
      const [payments] = await db.query('SELECT form_id, id FROM payments WHERE order_id = ?', [orderId]);
      if (payments.length > 0) {
        await db.query(`
          UPDATE student_forms 
          SET payment_status = 'PAID', payment_id = ?
          WHERE id = ?
        `, [payments[0].id, payments[0].form_id]);
      }

      console.log(`✅ Payment successful for order: ${orderId}`);
    } else if (eventType === 'PAYMENT_FAILED_WEBHOOK') {
      await db.query(`
        UPDATE payments SET status = 'FAILED', updated_at = NOW() WHERE order_id = ?
      `, [orderId]);
      
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
