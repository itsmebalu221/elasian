import { z } from 'zod';

export const externalRegistrationSchema = z.object({
  full_name: z.string()
    .min(2, 'Full name must be at least 2 characters')
    .max(255, 'Full name must be less than 255 characters'),
  email: z.string().email('Please provide a valid email address'),
  mobile: z.string()
    .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number'),
  institution: z.string()
    .min(2, 'Institution name must be at least 2 characters')
    .max(255, 'Institution name must be less than 255 characters'),
  department: z.string()
    .min(2, 'Department must be at least 2 characters')
    .max(255, 'Department must be less than 255 characters'),
  year_of_study: z.coerce.number()
    .int()
    .min(1, 'Year must be between 1 and 6')
    .max(6, 'Year must be between 1 and 6'),
  identity_number: z.string()
    .min(4, 'Identity number must be at least 4 characters')
    .max(100, 'Identity number must be less than 100 characters'),
  add_on_selected: z.boolean().optional(),
  selected_events: z.array(z.string().min(1)).max(2).optional()
});

export default externalRegistrationSchema;
