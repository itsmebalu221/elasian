import pool from '../db/mysql.js';
import { EVENT_DEFINITIONS, EVENT_TYPES } from '../config/events.config.js';

// Build lookup for event types
const EVENT_TYPE_LOOKUP = {};
for (const event of EVENT_DEFINITIONS) {
  EVENT_TYPE_LOOKUP[event.id] = event.type;
}

// Generate unique registration ID
function generateRegistrationId() {
  const year = new Date().getFullYear().toString().slice(-2);
  const random = Math.floor(100000 + Math.random() * 900000);
  return `ELYSIAN${year}${random}`;
}

// Submit student form to database
export async function submitStudentForm(studentId, formData) {
  // Validate input
  if (!formData || typeof formData !== 'object') {
    throw new Error('Invalid form data');
  }

  const {
    full_name,
    branch,
    roll_number,
    mobile,
    year_of_study,
    section
  } = formData;

  // Handle selected_events safely
  let selectedEvents = formData.selected_events;
  
  if (!selectedEvents) {
    throw new Error('Please select at least one event');
  }
  
  if (!Array.isArray(selectedEvents)) {
    throw new Error('Invalid events format');
  }
  
  if (selectedEvents.length === 0) {
    throw new Error('Please select at least one event');
  }

  const selectedEventsJson = JSON.stringify(selectedEvents);

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Check for existing form
    const [existing] = await connection.query(
      'SELECT id, registration_id FROM student_forms WHERE student_id = ?',
      [studentId]
    );

    let formId;
    let registrationId;

    if (existing.length > 0) {
      // Update existing form
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
          selected_events = ?,
          updated_at = NOW()
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
      // Create new form
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
          selected_events,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
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

    // Clear old event registrations
    await connection.query(
      'DELETE FROM event_registrations WHERE form_id = ?',
      [formId]
    );

    // Insert new event registrations
    if (selectedEvents.length > 0) {
      const registrationRows = [];
      
      for (const eventId of selectedEvents) {
        const eventType = EVENT_TYPE_LOOKUP[eventId] || EVENT_TYPES.DAY_1_ONLY;
        registrationRows.push([studentId, formId, eventId, eventType]);
      }

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

  // Parse selected_events JSON
  try {
    form.selected_events = form.selected_events ? JSON.parse(form.selected_events) : [];
  } catch {
    form.selected_events = [];
  }

  // Get event registrations
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
