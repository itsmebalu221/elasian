import { EVENT_DEFINITIONS, SAHITYA_EVENTS } from '../config/events.config.js';

const BRANCH_OPTIONS = ['CSE', 'EEE', 'ECE', 'MECH', 'CSC', 'CSD', 'CSO', 'CSM', 'ITP'];
const VALID_BRANCHES = new Set(BRANCH_OPTIONS);
const DEFAULT_BRANCH = BRANCH_OPTIONS[0];
// Force redeploy: 2026-01-08-v2
const VALID_EVENT_IDS = new Set(EVENT_DEFINITIONS.map(e => e.id));
const SAHITYA_EVENT_IDS = new Set((SAHITYA_EVENTS || []).map(event => event.id));

export function validateStudentForm(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: [{ field: 'form', message: 'Invalid form data' }] };
  }

  // full_name
  if (!data.full_name || typeof data.full_name !== 'string' || data.full_name.trim().length < 2) {
    errors.push({ field: 'full_name', message: 'Full name must be at least 2 characters' });
  }

  let normalizedBranch = DEFAULT_BRANCH;
  if (!data.branch || typeof data.branch !== 'string' || data.branch.trim().length === 0) {
    errors.push({ field: 'branch', message: 'Please select your branch' });
  } else {
    const branchValue = data.branch.trim().toUpperCase();
    if (!VALID_BRANCHES.has(branchValue)) {
      errors.push({ field: 'branch', message: 'Invalid branch selected' });
    } else {
      normalizedBranch = branchValue;
    }
  }

  // roll_number
  if (!data.roll_number || typeof data.roll_number !== 'string' || data.roll_number.length < 5) {
    errors.push({ field: 'roll_number', message: 'Roll number must be at least 5 characters' });
  } else if (!/^[A-Za-z0-9]+$/.test(data.roll_number)) {
    errors.push({ field: 'roll_number', message: 'Roll number must contain only letters and numbers' });
  }

  // mobile
  if (!data.mobile || !/^[6-9]\d{9}$/.test(data.mobile)) {
    errors.push({ field: 'mobile', message: 'Please enter a valid 10-digit Indian mobile number' });
  }

  // year_of_study
  const year = parseInt(data.year_of_study, 10);
  if (isNaN(year) || year < 1 || year > 4) {
    errors.push({ field: 'year_of_study', message: 'Year must be between 1 and 4' });
  }

  // selected_events
  if (!data.selected_events || !Array.isArray(data.selected_events) || data.selected_events.length === 0) {
    errors.push({ field: 'selected_events', message: 'Please select at least one event' });
  } else {
    const invalidEvents = data.selected_events.filter(id => !VALID_EVENT_IDS.has(id));
    if (invalidEvents.length > 0) {
      errors.push({ field: 'selected_events', message: 'Invalid event selection' });
    }
  }

  const sahityaSelection = parseSahityaPayload(data, errors);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      full_name: data.full_name.trim(),
      branch: normalizedBranch,
      roll_number: data.roll_number.trim(),
      mobile: data.mobile.trim(),
      year_of_study: year,
      selected_events: data.selected_events,
      ...sahityaSelection
    }
  };
}

function parseSahityaPayload(data, errors) {
  const response = {
    sahitya_selected: false,
    sahitya_participant_type: null,
    sahitya_events: []
  };

  if (!data || typeof data !== 'object') {
    return response;
  }

  const selected = data.sahitya_selected === true || data.sahitya_selected === 'true';
  if (!selected) {
    return response;
  }

  response.sahitya_selected = true;
  response.sahitya_participant_type = 'solo';

  const rawEvents = Array.isArray(data.sahitya_events) ? data.sahitya_events : [];
  const normalizedEvents = rawEvents
    .map(id => (typeof id === 'string' ? id.trim() : ''))
    .filter(id => id.length > 0);

  if (normalizedEvents.length === 0) {
    errors.push({ field: 'sahitya_events', message: 'Select at least one Sahitya event.' });
    return response;
  }

  const invalidEvents = normalizedEvents.filter(id => !SAHITYA_EVENT_IDS.has(id));
  if (invalidEvents.length > 0) {
    errors.push({ field: 'sahitya_events', message: 'Invalid Sahitya event selection.' });
    return response;
  }

  response.sahitya_events = Array.from(new Set(normalizedEvents));
  return response;
}

export default validateStudentForm;
