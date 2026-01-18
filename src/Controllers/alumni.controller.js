import { alumniRegistrationSchema } from '../Schemas/alumni.schema.js';
import * as alumniService from '../Services/alumni.service.js';
import * as paymentService from '../Services/payment.service.js';

const REUSE_WINDOW_MINUTES = 30;

export async function registerAlumni(req, res) {
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

        const validated = alumniRegistrationSchema.parse(payload);
        const result = await alumniService.createAlumniRegistration(validated);

        // Hide registration_id if payment is not complete
        const responseData = { ...result.record };
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
        console.error('Alumni registration error:', error);

        if (error.name === 'ZodError') {
            const message = error.errors?.[0]?.message || 'Invalid data provided';
            return res.status(400).json({ success: false, error: message });
        }

        return res.status(500).json({
            success: false,
            error: 'Failed to register alumni'
        });
    }
}

export async function createAlumniOrder(req, res) {
    try {
        const { registrationId } = req.body;
        const userEmail = req.user?.email?.toLowerCase().trim();

        if (!userEmail) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!registrationId) {
            return res.status(400).json({ error: 'Registration ID is required' });
        }

        const registration = await alumniService.getAlumniRegistrationById(registrationId);

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

        const existingPayment = await paymentService.getPaymentByAlumniRegistrationId(registration.id);
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
            alumniRegistrationId: registration.id,
            customerName: registration.full_name,
            customerEmail: registration.email,
            customerPhone: registration.mobile,
            amount: registration.total_amount,
            returnUrlPath: '/payment-status.html?type=alumni&order_id={order_id}',
            orderNote: `Elysian 2026 Alumni Pass - Registration ID: ${registration.registration_id}`
        });

        return res.json(result);
    } catch (error) {
        console.error('Alumni order error:', error);

        let errorDetails = {
            message: error.message,
            code: error.code || 'UNKNOWN',
            name: error.name
        };

        if (error.response?.data) {
            errorDetails.cashfreeError = error.response.data;
        }

        if (error.response) {
            errorDetails.statusCode = error.response.status;
            errorDetails.statusText = error.response.statusText;
        }

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

export async function getAlumniPaymentStatus(req, res) {
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

        const registration = await alumniService.getAlumniRegistrationById(numericId);

        if (!registration) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        // Verify the authenticated user owns this registration
        if (registration.email.toLowerCase().trim() !== userEmail) {
            return res.status(403).json({ error: 'You are not authorized to view this registration' });
        }

        const isPaid = await paymentService.isAlumniRegistrationPaid(registration.id);
        const payment = await paymentService.getPaymentByAlumniRegistrationId(registration.id);

        return res.json({
            isPaid,
            registration: {
                id: registration.id,
                code: isPaid ? registration.registration_id : null,
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
        console.error('Alumni payment status error:', error);
        return res.status(500).json({ error: 'Failed to get payment status' });
    }
}

export async function getAlumniRegistrationByEmail(req, res) {
    try {
        // Use authenticated user's email for security
        const email = req.user?.email;

        if (!email) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        const registration = await alumniService.getAlumniRegistrationByEmail(email.toLowerCase().trim());

        if (!registration) {
            return res.status(404).json({
                success: false,
                error: 'No registration found for this email'
            });
        }

        // Hide registration_id if payment is not complete
        const responseData = { ...registration };
        if (registration.payment_status !== 'PAID') {
            delete responseData.registration_id;
        }

        return res.json({
            success: true,
            registration: responseData
        });
    } catch (error) {
        console.error('Get alumni registration by email error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch registration'
        });
    }
}
