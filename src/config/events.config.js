export const EVENT_TYPES = Object.freeze({
  MULTI_DAY: 'MULTI_DAY',
  DAY_1_ONLY: 'DAY_1_ONLY',
  DAY_2_ONLY: 'DAY_2_ONLY',
  OPTIONAL: 'OPTIONAL'
});

export const EVENT_DEFINITIONS = [
  {
    id: 'EVT_WORKSHOP_EDGE_AI',
    name: 'Workshop on Edge AI',
    organizer: 'IEEE & IETE',
    type: EVENT_TYPES.MULTI_DAY,
    dayLabel: '2 Days Event, Time : 9:30 AM - 4:30 PM',
    description: 'Deep dive into building and deploying intelligence on the edge across both fest days.'
  },
  {
    id: 'EVT_VIBE_CODE',
    name: 'Vibe Coding Challenge',
    organizer: 'Coding Club',
    type: EVENT_TYPES.MULTI_DAY,
    dayLabel: 'Day 1 + Day 2 [ Online Event ]',
    description: 'Design the vibe. Code the experience. Deliver UI/UX that actually makes sense.'
  },
  {
    id: 'EVT_CIRCUIT_DEBUG',
    name: 'Circuit Debugging Competition',
    organizer: 'IEEE & IETE',
    type: EVENT_TYPES.DAY_2_ONLY,
    dayLabel: '2nd Day Event, Time : 10:00 AM - 2:30 PM',
    description: 'Hands-on race to diagnose and repair intricate hardware faults.'
  },
  {
    id: 'EVT_RESOURCE_TECH',
    name: 'Resource Tech',
    organizer: 'IUCEE-EWB (INNOFIESTA)',
    type: EVENT_TYPES.DAY_1_ONLY,
    dayLabel: '1st Day Event, Time : 1:00 PM - 4:30 PM',
    description: 'Parallel innovation sprint exploring sustainable resource technologies.'
  },
  {
    id: 'EVT_INSIGHT_DASH',
    name: 'InsightDash',
    organizer: 'IUCEE-EWB (INNOFIESTA)',
    type: EVENT_TYPES.DAY_1_ONLY,
    dayLabel: '1st Day Event, Time : 11:00 AM - 4:00 PM',
    description: 'Data-driven challenge to surface insights that matter for communities.'
  },
  {
    id: 'EVT_REVERSE_ENGINEERING',
    name: 'Reverse Engineering & Innovation Challenge',
    organizer: 'IUCEE-EWB (INNOFIESTA)',
    type: EVENT_TYPES.DAY_2_ONLY,
    dayLabel: '2nd Day Event, Time : 9:30 AM - 3:30 PM',
    description: 'Hands-on teardown marathon to re-imagine products with smarter solutions.'
  },
  {
    id: 'EVT_CODE_DEBUGGING',
    name: 'Code Debugging — Bug Bounty Hunt',
    organizer: 'CSI & Coding Club',
    type: EVENT_TYPES.DAY_1_ONLY,
    dayLabel: '1st Day Event, Time : 11:00 AM - 1:30 PM',
    description: 'Competitive debugging gauntlet to squash vulnerabilities under time pressure.'
  },
  {
    id: 'EVT_KEYBOARD_WAR',
    name: 'Keyboard War',
    organizer: 'CSI & Coding Club',
    type: EVENT_TYPES.DAY_1_ONLY,
    dayLabel: '1st Day Event, Time : 2:30 PM - 4:00 PM',
    description: 'Fast-paced real-time typing battles.'
  },
  {
    id: 'EVT_GEN_AI_HACK',
    name: 'GEN AI Hackathon',
    organizer: 'GDG & HHC',
    type: EVENT_TYPES.MULTI_DAY,
    dayLabel: '2 Days Event, Time : 9:30 AM - 4:00 PM',
    description: 'Two-day buildathon focused on generative AI breakthroughs.'
  },
  {
    id: 'EVT_BUSINESS_CANVAS',
    name: 'Marketing Madness - Sell the Unsellable',
    organizer: 'EDC',
    type: EVENT_TYPES.DAY_1_ONLY,
    dayLabel: '1st Day Event, Time : 10:00 AM - 2:00 PM',
    description: "Creative marketing challenge to pitch unconventional products."
  },

];

export const EVENT_LOOKUP = new Map(EVENT_DEFINITIONS.map(event => [event.id, event]));

export function validateEventSelections(selectedIds = []) {
  const normalized = Array.from(
    new Set((selectedIds || []).filter(value => typeof value === 'string' && value.trim().length > 0))
  );

  if (normalized.length === 0) {
    return { ok: false, reason: 'Please select at least one event.' };
  }

  if (normalized.length !== (selectedIds || []).filter(Boolean).length) {
    return { ok: false, reason: 'Duplicate events cannot be submitted.' };
  }

  const stats = {
    [EVENT_TYPES.MULTI_DAY]: 0,
    [EVENT_TYPES.DAY_1_ONLY]: 0,
    [EVENT_TYPES.DAY_2_ONLY]: 0,
    [EVENT_TYPES.OPTIONAL]: 0
  };

  for (const id of normalized) {
    const event = EVENT_LOOKUP.get(id);
    if (!event) {
      return { ok: false, reason: 'Unknown event selected.' };
    }
    stats[event.type] += 1;
  }

  const primarySelections = normalized.filter(id => {
    const event = EVENT_LOOKUP.get(id);
    return event && event.type !== EVENT_TYPES.OPTIONAL;
  });

  if (primarySelections.length === 0) {
    return { ok: false, reason: 'Select at least one primary event. Optional add-ons do not count.' };
  }

  if (stats[EVENT_TYPES.MULTI_DAY] > 0) {
    if (stats[EVENT_TYPES.MULTI_DAY] > 1) {
      return { ok: false, reason: 'Choose only one multi-day experience.' };
    }
    if (primarySelections.length > 1) {
      return { ok: false, reason: 'Multi-day events cannot be combined with other primary selections.' };
    }
  }

  if (stats[EVENT_TYPES.DAY_1_ONLY] > 1) {
    return { ok: false, reason: 'Only one Day 1 event can be selected at a time.' };
  }

  if (stats[EVENT_TYPES.DAY_2_ONLY] > 1) {
    return { ok: false, reason: 'Only one Day 2 event can be selected at a time.' };
  }

  if (
    stats[EVENT_TYPES.MULTI_DAY] > 0 &&
    (stats[EVENT_TYPES.DAY_1_ONLY] > 0 || stats[EVENT_TYPES.DAY_2_ONLY] > 0)
  ) {
    return { ok: false, reason: 'Multi-day events block Day 1 and Day 2 selections.' };
  }

  return { ok: true, normalized };
}

export function groupEventsByType() {
  return EVENT_DEFINITIONS.reduce((acc, event) => {
    acc[event.type] = acc[event.type] || [];
    acc[event.type].push(event);
    return acc;
  }, {});
}

// ============================================
// CULTURAL EVENTS - Sahitya & Prasasti
// ============================================

// Performance fee pricing
export const PRASASTI_SOLO_FEE = 150;
export const PRASASTI_GROUP_FEE = 350;

// Sahitya Events (Day 1 - Literary Fest)
export const SAHITYA_EVENTS = [
  { id: 'SAH_TREASURE_HUNT', name: 'Treasure Hunt' },
  { id: 'SAH_PLAYS', name: 'Dramas / Play' },
  { id: 'SAH_QUIZ', name: 'Quiz' },
  { id: 'SAH_SLAM_POETRY', name: 'Slam Poetry' }
];

// Prasasti Events (Day 2 - Cultural Fest)
// requiresPerformance: true means Solo/Group fee applies
export const PRASASTI_EVENTS = [
  { id: 'PRA_DANCE', name: 'Dance', description: 'Semi-Classical / Hip Hop / Freestyle / Social Message', requiresPerformance: true },
  { id: 'PRA_SINGING', name: 'Singing', requiresPerformance: true },
  { id: 'PRA_INSTRUMENTAL', name: 'Instrumental Music', requiresPerformance: true },
  { id: 'PRA_BEATBOXING', name: 'Beatboxing', requiresPerformance: true },
  { id: 'PRA_LIVE_PAINTING', name: 'Live Painting', requiresPerformance: false },
  { id: 'PRA_CLOTH_PAINTING', name: 'Cloth Painting', requiresPerformance: false },
  { id: 'PRA_ROLE_PLAY', name: 'Role Play', requiresPerformance: true },
  { id: 'PRA_MIMICRY', name: 'Mimicry', requiresPerformance: true }
];

// Lookup maps for validation
export const SAHITYA_EVENT_LOOKUP = new Map(SAHITYA_EVENTS.map(e => [e.id, e]));
export const PRASASTI_EVENT_LOOKUP = new Map(PRASASTI_EVENTS.map(e => [e.id, e]));

// Check if a Prasasti event requires performance fee
export function prasastiRequiresPerformance(eventId) {
  const event = PRASASTI_EVENT_LOOKUP.get(eventId);
  return event?.requiresPerformance === true;
}

// Calculate performance fee based on event and type
export function calculatePerformanceFee(prasastiEventId, performanceType) {
  if (!prasastiEventId || !performanceType) return 0;
  if (!prasastiRequiresPerformance(prasastiEventId)) return 0;
  return performanceType === 'group' ? PRASASTI_GROUP_FEE : PRASASTI_SOLO_FEE;
}
