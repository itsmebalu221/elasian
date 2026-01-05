import pool from '../db/mysql.js';
import { EVENT_DEFINITIONS, EVENT_TYPES } from '../config/events.config.js';

const EVENT_TYPE_LOOKUP = EVENT_DEFINITIONS.reduce((acc, event) => {
  acc[event.id] = event.type;
  return acc;
}, {});

// Generate unique registration ID
function generateRegistrationId() {
  const year = new Date().getFullYear().toString().slice(-2);
  const random = Math.floor(100000 + Math.random() * 900000); // 6 digit random
  return `HITAM${year}${random}`;
}

// Submit student form to database
export async function submitStudentForm(studentId, formData) {
  const {
    full_name,
    branch,
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
          full_name = ?,
          branch = ?,
          roll_number = ?,
          mobile = ?,
          year_of_study = ?,
          section = ?,
          selected_events = ?
        WHERE student_id = ?`,
        [
          full_name,
          branch,
          roll_number,
          mobile,
          year_of_study,
          section || null,
          selectedEventsJson,
          studentId
        ]
      );
    } else {
      registrationId = generateRegistrationId();

      const [result] = await connection.query(
        `INSERT INTO student_forms (
          student_id,
          registration_id,
          full_name,
          branch,
          roll_number,
          mobile,
          year_of_study,
          section,
          selected_events
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        , [
          studentId,
          registrationId,
          full_name,
          branch,
          roll_number,
          mobile,
          year_of_study,
          section || null,
          selectedEventsJson
        ]
      );

      formId = result.insertId;
    }

    await connection.query('DELETE FROM event_registrations WHERE form_id = ?', [formId]);

    const registrationRows = selected_events.map(eventId => ([
      studentId,
      formId,
      eventId,
      EVENT_TYPE_LOOKUP[eventId] || EVENT_TYPES.DAY_1_ONLY
    ]));

    if (registrationRows.length > 0) {
      await connection.query(
        `INSERT INTO event_registrations (student_id, form_id, event_id, selection_type)
         VALUES ?`,
        [registrationRows]
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

    if (error.code === 'ER_DUP_ENTRY') {
      if (error.message.includes('roll_number')) {
        throw new Error('This roll number is already registered');
      }
    }
    throw error;
  } finally {
    connection.release();
  }
}

// Get student form by student ID
export async function getStudentForm(studentId) {
  const [rows] = await pool.query(
    'SELECT * FROM student_forms WHERE student_id = ?',
    [studentId]
  );

  const form = rows[0];

  if (!form) {
    return null;
  }

  form.selected_events = form.selected_events ? JSON.parse(form.selected_events) : [];

  const [registrations] = await pool.query(
    'SELECT event_id, selection_type FROM event_registrations WHERE form_id = ? ORDER BY id',
    [form.id]
  );

  form.event_registrations = registrations;

  return form;
}

// Get student by ID
export async function getStudentById(studentId) {
  const [rows] = await pool.query(
    'SELECT * FROM students WHERE id = ?',
    [studentId]
  );
  return rows[0] || null;
}
