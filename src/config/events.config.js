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
    dayLabel: 'Day 1 + Day 2',
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
    dayLabel: 'Day 2',
    description: 'Hands-on race to diagnose and repair intricate hardware faults.'
  },
  {
    id: 'EVT_RESOURCE_TECH',
    name: 'Resource Tech',
    organizer: 'IUCEE-EWB (INNOFIESTA)',
    type: EVENT_TYPES.DAY_1_ONLY,
    dayLabel: 'Day 1',
    description: 'Parallel innovation sprint exploring sustainable resource technologies.'
  },
  {
    id: 'EVT_INSIGHT_DASH',
    name: 'InsightDash',
    organizer: 'IUCEE-EWB (INNOFIESTA)',
    type: EVENT_TYPES.DAY_1_ONLY,
    dayLabel: 'Day 1',
    description: 'Data-driven challenge to surface insights that matter for communities.'
  },
  {
    id: 'EVT_REVERSE_ENGINEERING',
    name: 'Reverse Engineering & Innovation Challenge',
    organizer: 'IUCEE-EWB (INNOFIESTA)',
    type: EVENT_TYPES.DAY_2_ONLY,
    dayLabel: 'Day 2',
    description: 'Hands-on teardown marathon to re-imagine products with smarter solutions.'
  },
  {
    id: 'EVT_CODE_DEBUGGING',
    name: 'Code Debugging — Bug Bounty Hunt',
    organizer: 'CSI & Coding Club',
    type: EVENT_TYPES.DAY_1_ONLY,
    dayLabel: 'Day 1',
    description: 'Competitive debugging gauntlet to squash vulnerabilities under time pressure.'
  },
  {
    id: 'EVT_KEYBOARD_WAR',
    name: 'Keyboard War',
    organizer: 'CSI & Coding Club',
    type: EVENT_TYPES.DAY_1_ONLY,
    dayLabel: 'Day 1',
    description: 'Fast-paced real-time typing battles.'
  },
  {
    id: 'EVT_GEN_AI_HACK',
    name: 'GEN AI Hackathon',
    organizer: 'GDG & HHC',
    type: EVENT_TYPES.MULTI_DAY,
    dayLabel: 'Day 1 + Day 2',
    description: 'Two-day buildathon focused on generative AI breakthroughs.'
  },
  {
    id: 'EVT_BUSINESS_CANVAS',
    name: 'Business Canvas Presentation',
    organizer: 'EDC',
    type: EVENT_TYPES.OPTIONAL,
    dayLabel: 'Day 1 + Day 2',
    description: 'Learn to create and present compelling business model canvases with the Entrepreneurship Development Cell.'
  },
  {
    id: 'EVT_CULTURAL_SAHITYA_PRASASTI',
    name: 'Sahitya + Prasasti Cultural Access',
    organizer: 'Cultural Committee',
    type: EVENT_TYPES.OPTIONAL,
    dayLabel: 'Cultural Add-on',
    description: 'Exclusive access to the Sahitya literature showcase and Prasasti cultural celebrations.'
  }
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
