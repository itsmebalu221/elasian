import { z } from 'zod';

export const createOrderSchema = z.object({
  studentId: z.number().int().positive(),
  formId: z.number().int().positive(),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid phone number')
});

export const verifyPaymentSchema = z.object({
  orderId: z.string().min(1)
});
