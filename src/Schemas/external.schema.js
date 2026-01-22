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

  // Events
  esparto_selected: z.boolean().optional(),
  esparto_mode: z.enum(['attendee', 'participant']).optional().nullable(),
  esparto_participant_type: z.enum(['solo', 'group']).optional().nullable(),
  esparto_team_members: z.string().optional().nullable(),
  esparto_events: z.array(z.string().min(1)).optional().default([]),

  sahitya_selected: z.boolean().optional(),
  sahitya_events: z.array(z.string().min(1)).optional().default([]),
  // Legacy fields removed/optional
  sahitya_mode: z.enum(['attendee', 'participant']).optional().nullable(),
  sahitya_participant_type: z.enum(['solo', 'group']).optional().nullable(),
  sahitya_team_members: z.string().optional().nullable(),

  prasasti_selected: z.boolean().optional(),
  prasasti_mode: z.enum(['attendee', 'participant']).optional().nullable(),
  prasasti_participant_type: z.enum(['solo', 'group']).optional().nullable(),
  prasasti_events: z.array(z.string().min(1)).optional().default([]),
  prasasti_team_members: z.string().optional().nullable(),

  // Legacy fields kept for compatibility but not primary anymore
  selected_events: z.array(z.string()).optional().default([]),
  prasasti_event: z.string().max(50).optional().nullable(),
  prasasti_performance_type: z.enum(['solo', 'group']).optional().nullable()
});

export default externalRegistrationSchema;

