import { z } from 'zod/v4';

// Event configuration - Define all available events
export const EVENT_CONFIG = {
  days: [
    { id: 'day1', name: 'Day 1', date: '2025-01-15' },
    { id: 'day2', name: 'Day 2', date: '2025-01-16' }
  ],
  timeSlots: [
    { id: 'slot1', name: 'Slot 1', time: '10:00 AM - 12:00 PM', start: '10:00', end: '12:00' },
    { id: 'slot2', name: 'Slot 2', time: '1:00 PM - 3:00 PM', start: '13:00', end: '15:00' },
    { id: 'slot3', name: 'Slot 3', time: '3:00 PM - 5:00 PM', start: '15:00', end: '17:00' }
  ],
  lunchBreak: { time: '12:00 PM - 1:00 PM', start: '12:00', end: '13:00' },
  events: {
    // Day 1 Events
    day1: {
      slot1: [
        { id: 'D1S1E1', name: 'Technical Quiz', venue: 'Seminar Hall A', description: 'Test your technical knowledge' },
        { id: 'D1S1E2', name: 'Coding Challenge', venue: 'Computer Lab 1', description: 'Competitive programming contest' },
        { id: 'D1S1E3', name: 'Paper Presentation', venue: 'Conference Room', description: 'Present your research papers' },
        { id: 'D1S1E4', name: 'Poster Exhibition', venue: 'Main Lobby', description: 'Display your creative posters' }
      ],
      slot2: [
        { id: 'D1S2E1', name: 'Hackathon Round 1', venue: 'Computer Lab 1 & 2', description: 'Build innovative solutions' },
        { id: 'D1S2E2', name: 'Web Development', venue: 'Computer Lab 3', description: 'Create stunning websites' },
        { id: 'D1S2E3', name: 'Debugging Contest', venue: 'Computer Lab 4', description: 'Find and fix bugs' },
        { id: 'D1S2E4', name: 'Tech Talk', venue: 'Auditorium', description: 'Listen to industry experts' }
      ],
      slot3: [
        { id: 'D1S3E1', name: 'Gaming Tournament', venue: 'Gaming Arena', description: 'Compete in esports' },
        { id: 'D1S3E2', name: 'UI/UX Design', venue: 'Design Lab', description: 'Design user interfaces' },
        { id: 'D1S3E3', name: 'Database Challenge', venue: 'Computer Lab 2', description: 'SQL and NoSQL challenges' },
        { id: 'D1S3E4', name: 'Networking Workshop', venue: 'Network Lab', description: 'Learn networking concepts' }
      ]
    },
    // Day 2 Events
    day2: {
      slot1: [
        { id: 'D2S1E1', name: 'AI/ML Workshop', venue: 'AI Lab', description: 'Hands-on machine learning' },
        { id: 'D2S1E2', name: 'Mobile App Dev', venue: 'Computer Lab 1', description: 'Build mobile applications' },
        { id: 'D2S1E3', name: 'Cybersecurity CTF', venue: 'Security Lab', description: 'Capture the flag challenge' },
        { id: 'D2S1E4', name: 'Group Discussion', venue: 'Seminar Hall B', description: 'Discuss trending topics' }
      ],
      slot2: [
        { id: 'D2S2E1', name: 'Hackathon Final', venue: 'Computer Lab 1 & 2', description: 'Final hackathon round' },
        { id: 'D2S2E2', name: 'Cloud Computing', venue: 'Cloud Lab', description: 'Deploy on cloud platforms' },
        { id: 'D2S2E3', name: 'IoT Workshop', venue: 'IoT Lab', description: 'Internet of Things hands-on' },
        { id: 'D2S2E4', name: 'Tech Debate', venue: 'Auditorium', description: 'Debate on tech topics' }
      ],
      slot3: [
        { id: 'D2S3E1', name: 'Project Showcase', venue: 'Main Hall', description: 'Display your projects' },
        { id: 'D2S3E2', name: 'Blockchain Basics', venue: 'Computer Lab 3', description: 'Learn blockchain technology' },
        { id: 'D2S3E3', name: 'DevOps Workshop', venue: 'DevOps Lab', description: 'CI/CD and automation' },
        { id: 'D2S3E4', name: 'Prize Distribution', venue: 'Auditorium', description: 'Award ceremony' }
      ]
    }
  }
};

// Get all valid event IDs
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

// Event selections schema - one event per time slot per day
export const eventSelectionsSchema = z.object({
  day1_slot1: eventSelectionSchema,
  day1_slot2: eventSelectionSchema,
  day1_slot3: eventSelectionSchema,
  day2_slot1: eventSelectionSchema,
  day2_slot2: eventSelectionSchema,
  day2_slot3: eventSelectionSchema
}).refine((data) => {
  // Validate that selected event IDs are valid
  const validIds = getAllEventIds();
  const selections = Object.values(data).filter(v => v !== null && v !== undefined && v !== '');
  return selections.every(id => validIds.includes(id));
}, {
  message: 'Invalid event selection'
}).refine((data) => {
  // Ensure at least one event is selected
  const selections = Object.values(data).filter(v => v !== null && v !== undefined && v !== '');
  return selections.length > 0;
}, {
  message: 'Please select at least one event to attend'
});

export default eventSelectionsSchema;
