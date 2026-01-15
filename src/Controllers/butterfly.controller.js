import { butterflyRegistrationSchema } from '../Schemas/butterfly.schema.js';
import * as butterflyService from '../Services/butterfly.service.js';
import * as paymentService from '../Services/payment.service.js';

const REUSE_WINDOW_MINUTES = 30;

export async function registerButterflyOffer(req, res) {
    try {
        console.log('🦋 Register request - req.user:', req.user ? { email: req.user.email, id: req.user.id } : 'none');

        const userEmail = req.user?.email;
        if (!userEmail) {
            console.log('🦋 Auth check failed - no email in req.user');
            return res.status(401).json({
                success: false,
                error: 'Authentication required. Please login first.'
            });
        }

        console.log('🦋 Validating request body...');
        const validated = butterflyRegistrationSchema.parse(req.body);
        console.log('🦋 Validation passed, creating registration...');

        const result = await butterflyService.createButterflyRegistration(validated, userEmail);

        const responseData = { ...result.record };
        if (!result.isPaid) {
            delete responseData.registration_id;
            delete responseData.qr_codes;
        }

        return res.json({
            success: true,
            registration: responseData,
            isExisting: result.isExisting,
            isPaid: result.isPaid
        });
    } catch (error) {
        console.error('🦋 Butterfly registration error:', error.name, error.message);

        if (error.name === 'ZodError') {
            // Build a clear error message showing which field failed
            const firstError = error.errors?.[0];
            let message = 'Invalid form data';

            if (firstError) {
                const path = firstError.path || [];
                // Convert path like ['student2', 'email'] to "Student 2 Email"
                const fieldPath = path.map((p, i) => {
                    if (typeof p === 'string' && p.startsWith('student')) {
                        const num = p.replace('student', '');
                        return `Student ${num}`;
                    }
                    return p.charAt(0).toUpperCase() + p.slice(1).replace(/_/g, ' ');
                }).join(' → ');

                message = fieldPath
                    ? `${fieldPath}: ${firstError.message}`
                    : firstError.message;
            }

            console.log('🦋 Validation error:', message);
            return res.status(400).json({ success: false, error: message });
        }

        return res.status(500).json({
            success: false,
            error: 'Failed to register. Please try again.'
        });
    }
}

export async function createButterflyOrder(req, res) {
    try {
        const { registrationId } = req.body;
        const userEmail = req.user?.email?.toLowerCase().trim();

        if (!userEmail) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!registrationId) {
            return res.status(400).json({ error: 'Registration ID is required' });
        }

        const registration = await butterflyService.getButterflyRegistrationById(registrationId);

        if (!registration) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        if (registration.primary_email.toLowerCase().trim() !== userEmail) {
            console.warn(`Payment attempt by ${userEmail} for registration owned by ${registration.primary_email}`);
            return res.status(403).json({ error: 'You are not authorized to pay for this registration' });
        }

        if (registration.payment_status === 'PAID') {
            return res.status(400).json({ error: 'Payment already completed for this registration' });
        }

        const existingPayment = await paymentService.getPaymentByButterflyRegistrationId(registration.id);
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
            butterflyRegistrationId: registration.id,
            customerName: registration.student1_name,
            customerEmail: registration.primary_email,
            customerPhone: registration.student1_mobile,
            amount: registration.total_amount,
            returnUrlPath: '/payment-status.html?type=butterfly&order_id={order_id}',
            orderNote: `Butterfly Offer - Registration ID: ${registration.registration_id}`
        });

        return res.json(result);
    } catch (error) {
        console.error('Butterfly order error:', error);

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

        return res.status(500).json({
            error: 'Failed to create payment order',
            message: error.message,
            details: errorDetails
        });
    }
}

export async function getButterflyPaymentStatus(req, res) {
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

        const registration = await butterflyService.getButterflyRegistrationById(numericId);

        if (!registration) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        if (registration.primary_email.toLowerCase().trim() !== userEmail) {
            return res.status(403).json({ error: 'You are not authorized to view this registration' });
        }

        const isPaid = await paymentService.isButterflyRegistrationPaid(registration.id);
        const payment = await paymentService.getPaymentByButterflyRegistrationId(registration.id);

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
        console.error('Butterfly payment status error:', error);
        return res.status(500).json({ error: 'Failed to get payment status' });
    }
}

export async function getButterflyQRCodes(req, res) {
    try {
        const userEmail = req.user?.email?.toLowerCase().trim();
        console.log('🦋 QR Codes request from:', userEmail);

        if (!userEmail) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const registration = await butterflyService.getButterflyRegistrationByEmail(userEmail);
        console.log('🦋 Found registration:', registration ? { id: registration.id, payment_status: registration.payment_status } : 'null');

        if (!registration) {
            return res.status(404).json({ error: 'No registration found' });
        }

        if (registration.payment_status !== 'PAID') {
            console.log('🦋 Registration not paid, denying QR access');
            return res.status(403).json({ error: 'Payment required to access QR codes' });
        }

        // Generate QR codes if not already generated
        let qrCodes = registration.qr_codes;
        if (!qrCodes) {
            qrCodes = await butterflyService.generateQRCodes(registration);
            await butterflyService.updateQRCodes(registration.id, qrCodes);
        } else if (typeof qrCodes === 'string') {
            qrCodes = JSON.parse(qrCodes);
        }

        return res.json({
            success: true,
            registrationId: registration.registration_id,
            qrCodes
        });
    } catch (error) {
        console.error('Get QR codes error:', error);
        return res.status(500).json({ error: 'Failed to get QR codes' });
    }
}

export async function getButterflyRegistrationByEmail(req, res) {
    try {
        const email = req.user?.email;

        if (!email) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        const registration = await butterflyService.getButterflyRegistrationByEmail(email.toLowerCase().trim());

        if (!registration) {
            return res.status(404).json({
                success: false,
                error: 'No registration found for this email'
            });
        }

        const responseData = { ...registration };
        if (registration.payment_status !== 'PAID') {
            delete responseData.registration_id;
            delete responseData.qr_codes;
        }

        return res.json({
            success: true,
            registration: responseData
        });
    } catch (error) {
        console.error('Get butterfly registration by email error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch registration'
        });
    }
}
