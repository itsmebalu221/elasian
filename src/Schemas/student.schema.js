import { z } from 'zod/v4';
import { EVENT_DEFINITIONS, validateEventSelections } from '../config/events.config.js';

const VALID_EVENT_IDS = new Set(EVENT_DEFINITIONS.map(event => event.id));

// Student form validation schema
export const studentFormSchema = z.object({
  full_name: z.string()
    .min(2, 'Full name must be at least 2 characters')
    .max(255, 'Full name must be less than 255 characters'),
  
  branch: z.enum([
    'CSE',
    'ECE',
    'EEE',
    'MECH',
    'CIVIL',
    'IT',
    'AIDS',
    'AIML',
    'CSM',
    'CSD',
    'CSC',
    'IOT'
  ], {
    error: 'Please select a valid branch'
  }),
  
  roll_number: z.string()
    .min(5, 'Roll number must be at least 5 characters')
    .max(50, 'Roll number must be less than 50 characters')
    .regex(/^[A-Za-z0-9]+$/, 'Roll number must contain only letters and numbers'),
  
  mobile: z.string()
    .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number'),
  
  year_of_study: z.coerce.number()
    .int()
    .min(1, 'Year must be between 1 and 4')
    .max(4, 'Year must be between 1 and 4'),
  
  section: z.string()
    .max(10, 'Section must be less than 10 characters')
    .optional(),

  selected_events: z.array(z.string().min(1))
    .min(1, 'Please select at least one event to attend')
    .superRefine((events, ctx) => {
      if (!events.every(id => VALID_EVENT_IDS.has(id))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid event selection',
          path: ['selected_events']
        });
      }
    })
}).superRefine((data, ctx) => {
  const result = validateEventSelections(data.selected_events);
  if (!result.ok) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: result.reason,
      path: ['selected_events']
    });
  }
});

export default studentFormSchema;
