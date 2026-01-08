import pool from '../db/mysql.js';
import { EVENT_DEFINITIONS, EVENT_TYPES } from '../config/events.config.js';

const EVENT_TYPE_LOOKUP = {};
for (const event of EVENT_DEFINITIONS) {
  EVENT_TYPE_LOOKUP[event.id] = event.type;
}

function generateRegistrationId() {
  const year = new Date().getFullYear().toString().slice(-2);
  const random = Math.floor(100000 + Math.random() * 900000);
  return `ELYSIAN${year}${random}`;
}

export async function submitStudentForm(studentId, formData) {
  const {
    full_name,

    roll_number,
    mobile,
    year_of_study,
    section,
    selected_events
  } = formData;

  const selectedEventsJson = JSON.stringify(selected_events);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existing] = await connection.query(
      'SELECT id, registration_id FROM student_forms WHERE student_id = ?',
      [studentId]
    );

    let formId;
    let registrationId;

    if (existing.length > 0) {
      formId = existing[0].id;
      registrationId = existing[0].registration_id;

      await connection.query(
        `UPDATE student_forms SET 
          full_name = ?, roll_number = ?, mobile = ?,
          year_of_study = ?, section = ?, selected_events = ?, updated_at = NOW()
        WHERE student_id = ?`,
        [full_name, roll_number, mobile, year_of_study, section, selectedEventsJson, studentId]
      );
    } else {
      registrationId = generateRegistrationId();

      const [result] = await connection.query(
        `INSERT INTO student_forms 
          (student_id, registration_id, full_name, roll_number, mobile, year_of_study, section, selected_events, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [studentId, registrationId, full_name, roll_number, mobile, year_of_study, section, selectedEventsJson]
      );

      formId = result.insertId;
    }

    await connection.query('DELETE FROM event_registrations WHERE form_id = ?', [formId]);

    for (const eventId of selected_events) {
      const eventType = EVENT_TYPE_LOOKUP[eventId] || EVENT_TYPES.DAY_1_ONLY;
      await connection.query(
        'INSERT INTO event_registrations (student_id, form_id, event_id, selection_type) VALUES (?, ?, ?, ?)',
        [studentId, formId, eventId, eventType]
      );
    }

    await connection.commit();

    return {
      status: existing.length > 0 ? 'updated' : 'created',
      message: existing.length > 0 ? 'Form updated successfully' : 'Form submitted successfully',
      formId,
      registrationId
    };
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY' && error.message.includes('roll_number')) {
      throw new Error('This roll number is already registered');
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function getStudentForm(studentId) {
  const [rows] = await pool.query(
    'SELECT * FROM student_forms WHERE student_id = ?',
    [studentId]
  );

  const form = rows[0];
  if (!form) return null;

  try {
    form.selected_events = form.selected_events ? JSON.parse(form.selected_events) : [];
  } catch {
    form.selected_events = [];
  }

  const [registrations] = await pool.query(
    'SELECT event_id, selection_type FROM event_registrations WHERE form_id = ? ORDER BY id',
    [form.id]
  );

  form.event_registrations = registrations;
  return form;
}

export async function getStudentById(studentId) {
  const [rows] = await pool.query('SELECT * FROM students WHERE id = ?', [studentId]);
  return rows[0] || null;
}
