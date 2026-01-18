import { z } from 'zod';

const VALID_BRANCHES = ['CSE', 'EEE', 'ECE', 'MECH', 'CSC', 'CSD', 'CSO', 'CSM', 'ITP'];
const CURRENT_YEAR = new Date().getFullYear();

export const alumniRegistrationSchema = z.object({
    full_name: z.string()
        .min(2, 'Full name must be at least 2 characters')
        .max(255, 'Full name must be less than 255 characters'),
    email: z.string().email('Please provide a valid email address'),
    mobile: z.string()
        .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number'),
    branch: z.string()
        .refine(val => VALID_BRANCHES.includes(val.toUpperCase()), {
            message: 'Please select a valid branch'
        })
        .transform(val => val.toUpperCase()),
    year_of_graduation: z.coerce.number()
        .int()
        .min(2000, 'Year of graduation must be between 2000 and current year')
        .max(CURRENT_YEAR, `Year of graduation must be ${CURRENT_YEAR} or earlier`)
});

export default alumniRegistrationSchema;
