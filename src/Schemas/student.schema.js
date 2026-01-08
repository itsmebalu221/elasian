import { EVENT_DEFINITIONS } from '../config/events.config.js';

// Force redeploy: 2026-01-08-v2
const VALID_EVENT_IDS = new Set(EVENT_DEFINITIONS.map(e => e.id));

export function validateStudentForm(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: [{ field: 'form', message: 'Invalid form data' }] };
  }

  // full_name
  if (!data.full_name || typeof data.full_name !== 'string' || data.full_name.trim().length < 2) {
    errors.push({ field: 'full_name', message: 'Full name must be at least 2 characters' });
  }

  // branch - just check it exists, accept any value
  if (!data.branch || typeof data.branch !== 'string' || data.branch.trim().length === 0) {
    errors.push({ field: 'branch', message: 'Please select a branch' });
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

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      full_name: data.full_name.trim(),
      branch: data.branch.trim().toUpperCase(),
      roll_number: data.roll_number.trim(),
      mobile: data.mobile.trim(),
      year_of_study: year,
      section: data.section ? data.section.trim() : null,
      selected_events: data.selected_events
    }
  };
}

export default validateStudentForm;
