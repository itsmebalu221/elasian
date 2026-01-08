import crypto from 'crypto';
import db from '../db/mysql.js';

export const EXTERNAL_BASE_AMOUNT = 700;
export const EXTERNAL_ADD_ON_AMOUNT = 300;
const PREMIUM_EVENT_IDS = new Set(['prasasti', 'sahitya']);
const MAX_SELECTED_EVENTS = 2;

function generateExternalRegistrationId() {
  const year = new Date().getFullYear().toString().slice(-2);
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ELYSIANX${year}${random}`;
}

function normalizeSelectedEvents(selected = []) {
  if (!Array.isArray(selected)) {
    return null;
  }
  const trimmed = selected
    .filter(eventId => typeof eventId === 'string' && eventId.trim().length > 0)
    .slice(0, MAX_SELECTED_EVENTS);
  return trimmed.length > 0 ? JSON.stringify(trimmed) : null;
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
    add_on_selected = false,
    selected_events = []
  } = payload;

  const normalizedSelectedEvents = Array.isArray(selected_events) ? selected_events : [];
  const hasPremiumSelection = normalizedSelectedEvents.some(eventId => PREMIUM_EVENT_IDS.has(eventId));
  const addOnSelected = Boolean(add_on_selected && hasPremiumSelection);
  const totalAmount = EXTERNAL_BASE_AMOUNT + (addOnSelected ? EXTERNAL_ADD_ON_AMOUNT : 0);
  const selectedEventsJson = normalizeSelectedEvents(selected_events);

  const [existingRows] = await db.query(
    'SELECT * FROM external_registrations WHERE identity_number = ?',
    [identity_number]
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

    const updateSelectedEvents = Array.isArray(selected_events) ? selected_events : [];
    const updateHasPremiumSelection = updateSelectedEvents.some(eventId => PREMIUM_EVENT_IDS.has(eventId));
    const updateAddOnSelected = Boolean(add_on_selected && updateHasPremiumSelection);
    const updateTotalAmount = EXTERNAL_BASE_AMOUNT + (updateAddOnSelected ? EXTERNAL_ADD_ON_AMOUNT : 0);

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
           selected_events = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [
        full_name,
        email,
        mobile,
        institution,
        department,
        year_of_study,
        updateAddOnSelected,
        updateTotalAmount,
        selectedEventsJson,
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
      selected_events
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      selectedEventsJson
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
