import crypto from 'crypto';
import db from '../db/mysql.js';
import {
  SAHITYA_EVENT_LOOKUP,
  PRASASTI_EVENT_LOOKUP,
  calculatePerformanceFee
} from '../config/events.config.js';

export const EXTERNAL_BASE_AMOUNT = 500;
export const EXTERNAL_ADD_ON_AMOUNT = 500;
export const PRASASTI_SOLO_FEE = 150;
export const PRASASTI_GROUP_FEE = 350;
const MAX_SELECTED_EVENTS = 20; // Increased limit
const MAX_ESPARTO_EVENTS = 2;
const PRICING = {
  // Esparto pricing
  ESPARTO_SOLO: 500,
  // Sahitya pricing (new solo/group structure)
  SAHITYA_SOLO: 150,
  SAHITYA_GROUP: 450,  // Group of 4
  // Prasasti pricing
  PRASASTI_ATTENDEE: 300,
  PRASASTI_SOLO: 150,
  PRASASTI_GROUP: 350
};

function generateExternalRegistrationId() {
  const year = new Date().getFullYear().toString().slice(-2);
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ELYSIANX${year}${random}`;
}

function sanitizeEventIds(selected = [], limit = MAX_SELECTED_EVENTS) {
  if (!Array.isArray(selected)) {
    return [];
  }
  const trimmed = selected
    .filter(eventId => typeof eventId === 'string' && eventId.trim().length > 0)
    .slice(0, limit);
  return trimmed;
}

function normalizeSelectedEvents(selected = []) {
  const trimmed = sanitizeEventIds(selected);
  return trimmed.length > 0 ? JSON.stringify(trimmed) : null;
}

function normalizeJsonValue(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed);
      return JSON.stringify(parsed);
    } catch {
      return JSON.stringify(trimmed);
    }
  }

  return JSON.stringify(value);
}

export async function createExternalRegistration(payload) {
  const {
    full_name,
    email,
    mobile,
    institution,
    department,
    year_of_study,
    identity_number,
    // Esparto fields
    esparto_selected = false,
    esparto_mode = null,
    esparto_events = [],
    // Sahitya fields (now with solo/group)
    sahitya_selected = false,
    sahitya_participant_type = null,
    sahitya_team_members = null,
    sahitya_events = [],
    // Prasasti fields
    prasasti_selected = false,
    prasasti_mode = null,
    prasasti_participant_type = null,
    prasasti_events = [],
    prasasti_team_members = null
  } = payload;

  const normalizedEspartoType = esparto_selected ? 'solo' : null;
  const sanitizedEspartoEvents = sanitizeEventIds(esparto_events, MAX_ESPARTO_EVENTS);

  // 1. Calculate Total Amount Server-side
  let totalAmount = 0;
  let addOnSelected = false; // Flag to legacy support

  if (esparto_selected) {
    totalAmount += PRICING.ESPARTO_SOLO;
  }

  if (sahitya_selected) {
    addOnSelected = true;
    if (sahitya_participant_type === 'group') {
      totalAmount += PRICING.SAHITYA_GROUP;
    } else {
      totalAmount += PRICING.SAHITYA_SOLO;
    }
  }

  if (prasasti_selected && prasasti_mode) {
    addOnSelected = true;
    if (prasasti_mode === 'attendee') {
      totalAmount += PRICING.PRASASTI_ATTENDEE;
    } else if (prasasti_participant_type === 'solo') {
      totalAmount += PRICING.PRASASTI_SOLO;
    } else if (prasasti_participant_type === 'group') {
      totalAmount += PRICING.PRASASTI_GROUP;
    } else {
      // Default fallback
      totalAmount += PRICING.PRASASTI_SOLO;
    }
  }

  // 2. Format JSON fields
  const espartoEventsJson = sanitizedEspartoEvents.length > 0 ? JSON.stringify(sanitizedEspartoEvents) : null;
  const sahityaEventsJson = sanitizeEventIds(sahitya_events).length > 0 ? JSON.stringify(sanitizeEventIds(sahitya_events)) : null;
  const prasastiEventsJson = sanitizeEventIds(prasasti_events).length > 0 ? JSON.stringify(sanitizeEventIds(prasasti_events)) : null;
  const espartoTeamMembersJson = null;
  const sahityaTeamMembersJson = normalizeJsonValue(sahitya_team_members);
  const prasastiTeamMembersJson = normalizeJsonValue(prasasti_team_members);

  // 3. Check for existing registration
  const [existingRows] = await db.query(
    'SELECT * FROM external_registrations WHERE email = ?',
    [email]
  );

  if (existingRows.length > 0) {
    const existing = existingRows[0];

    if (existing.payment_status === 'PAID') {
      return {
        record: existing,
        isExisting: true,
        isPaid: true
      };
    }

    await db.query(
      `UPDATE external_registrations
       SET full_name = ?,
           email = ?,
           mobile = ?,
           institution = ?,
           department = ?,
           year_of_study = ?,
           add_on_selected = ?,
           total_amount = ?,
           esparto_selected = ?,
           esparto_events = ?,
           esparto_mode = ?,
           esparto_participant_type = ?,
           esparto_team_members = ?,
           sahitya_selected = ?,
           sahitya_participant_type = ?,
           sahitya_team_members = ?,
           sahitya_events = ?,
           prasasti_selected = ?,
           prasasti_events = ?,
           prasasti_mode = ?,
           prasasti_participant_type = ?,
           prasasti_team_members = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [
        full_name,
        email,
        mobile,
        institution,
        department,
        year_of_study,
        addOnSelected,
        totalAmount,
        esparto_selected,
        espartoEventsJson,
        esparto_mode,
        normalizedEspartoType,
        espartoTeamMembersJson,
        sahitya_selected,
        sahitya_participant_type,
        sahityaTeamMembersJson,
        sahityaEventsJson,
        prasasti_selected,
        prasastiEventsJson,
        prasasti_mode,
        prasasti_participant_type,
        prasastiTeamMembersJson,
        existing.id
      ]
    );

    const [updatedRows] = await db.query(
      'SELECT * FROM external_registrations WHERE id = ?',
      [existing.id]
    );

    return {
      record: updatedRows[0],
      isExisting: true,
      isPaid: false
    };
  }

  // 4. Create new registration
  const registrationId = generateExternalRegistrationId();
  const [result] = await db.query(
    `INSERT INTO external_registrations (
      registration_id,
      full_name,
      email,
      mobile,
      institution,
      department,
      year_of_study,
      identity_number,
      add_on_selected,
      total_amount,
      esparto_selected,
      esparto_events,
      esparto_mode,
      esparto_participant_type,
      esparto_team_members,
      sahitya_selected,
      sahitya_participant_type,
      sahityaTeamMembersJson,
      sahitya_events,
      prasasti_selected,
      prasasti_events,
      prasasti_mode,
      prasasti_participant_type,
      prasasti_team_members
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    , [
      registrationId,
      full_name,
      email,
      mobile,
      institution,
      department,
      year_of_study,
      identity_number,
      addOnSelected,
      totalAmount,
      esparto_selected,
      espartoEventsJson,
      esparto_mode,
      normalizedEspartoType,
      espartoTeamMembersJson,
      sahitya_selected,
      sahitya_participant_type,
      sahitya_team_members,
      sahityaEventsJson,
      prasasti_selected,
      prasastiEventsJson,
      prasasti_mode,
      prasasti_participant_type,
      prasastiTeamMembersJson
    ]
  );

  const [rows] = await db.query(
    'SELECT * FROM external_registrations WHERE id = ?',
    [result.insertId]
  );

  return {
    record: rows[0],
    isExisting: false,
    isPaid: false
  };
}

export async function getExternalRegistrationById(id) {
  const [rows] = await db.query(
    'SELECT * FROM external_registrations WHERE id = ?',
    [id]
  );
  return rows[0] || null;
}

export async function getExternalRegistrationByCode(registrationId) {
  const [rows] = await db.query(
    'SELECT * FROM external_registrations WHERE registration_id = ?',
    [registrationId]
  );
  return rows[0] || null;
}

export async function getExternalRegistrationByIdentity(identityNumber) {
  const [rows] = await db.query(
    'SELECT * FROM external_registrations WHERE identity_number = ?',
    [identityNumber]
  );
  return rows[0] || null;
}

export async function getExternalRegistrationByEmail(email) {
  const [rows] = await db.query(
    'SELECT * FROM external_registrations WHERE email = ? ORDER BY created_at DESC LIMIT 1',
    [email]
  );
  return rows[0] || null;
}
