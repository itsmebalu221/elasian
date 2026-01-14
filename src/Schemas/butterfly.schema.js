import { z } from 'zod';

// Schema for a single student
const studentSchema = z.object({
    name: z.string()
        .min(2, 'Name must be at least 2 characters')
        .max(255, 'Name must be less than 255 characters'),
    branch: z.string()
        .min(2, 'Branch must be at least 2 characters')
        .max(100, 'Branch must be less than 100 characters'),
    roll_number: z.string()
        .min(4, 'Roll number must be at least 4 characters')
        .max(50, 'Roll number must be less than 50 characters'),
    mobile: z.string()
        .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number'),
    email: z.string().email('Please provide a valid email address')
});

// Schema for butterfly offer registration (4 students)
export const butterflyRegistrationSchema = z.object({
    student1: studentSchema,
    student2: studentSchema,
    student3: studentSchema,
    student4: studentSchema
});

export default butterflyRegistrationSchema;
