import { z } from 'zod/v4';
import { eventSelectionsSchema, EVENT_CONFIG } from './event.schema.js';

// Get all valid event IDs for validation
function getAllEventIds() {
  const eventIds = [];
  for (const day of Object.keys(EVENT_CONFIG.events)) {
    for (const slot of Object.keys(EVENT_CONFIG.events[day])) {
      for (const event of EVENT_CONFIG.events[day][slot]) {
        eventIds.push(event.id);
      }
    }
  }
  return eventIds;
}

// Event selection schema for a single slot
const eventSelectionSchema = z.string().nullable().optional();

// Student form validation schema
export const studentFormSchema = z.object({
  full_name: z.string()
    .min(2, 'Full name must be at least 2 characters')
    .max(255, 'Full name must be less than 255 characters'),
  
  branch: z.enum([
    'CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AIDS', 'AIML', 'CSM', 'CSD'
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

  // Event selections - one event per time slot per day
  day1_slot1: eventSelectionSchema,
  day1_slot2: eventSelectionSchema,
  day1_slot3: eventSelectionSchema,
  day2_slot1: eventSelectionSchema,
  day2_slot2: eventSelectionSchema,
  day2_slot3: eventSelectionSchema
}).refine((data) => {
  // Validate that selected event IDs are valid
  const validIds = getAllEventIds();
  const eventFields = ['day1_slot1', 'day1_slot2', 'day1_slot3', 'day2_slot1', 'day2_slot2', 'day2_slot3'];
  const selections = eventFields
    .map(f => data[f])
    .filter(v => v !== null && v !== undefined && v !== '');
  return selections.every(id => validIds.includes(id));
}, {
  message: 'Invalid event selection'
}).refine((data) => {
  // Ensure at least one event is selected
  const eventFields = ['day1_slot1', 'day1_slot2', 'day1_slot3', 'day2_slot1', 'day2_slot2', 'day2_slot3'];
  const selections = eventFields
    .map(f => data[f])
    .filter(v => v !== null && v !== undefined && v !== '');
  return selections.length > 0;
}, {
  message: 'Please select at least one event to attend'
});

export { EVENT_CONFIG };
export default studentFormSchema;
