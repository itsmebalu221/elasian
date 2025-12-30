import pool from '../db/mysql.js';

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
    section
  } = formData;

  try {
    // Check if student already submitted a form
    const [existing] = await pool.query(
      'SELECT id, registration_id FROM student_forms WHERE student_id = ?',
      [studentId]
    );

    if (existing.length > 0) {
      // Update existing form (keep existing registration_id)
      await pool.query(
        `UPDATE student_forms SET 
          full_name = ?, branch = ?, roll_number = ?, mobile = ?, 
          year_of_study = ?, section = ?
        WHERE student_id = ?`,
        [full_name, branch, roll_number, mobile, year_of_study, section || null, studentId]
      );

      return {
        status: 'updated',
        message: 'Form updated successfully',
        formId: existing[0].id,
        registrationId: existing[0].registration_id
      };
    }

    // Generate unique registration ID for new submission
    const registrationId = generateRegistrationId();

    // Insert new form with registration ID
    const [result] = await pool.query(
      `INSERT INTO student_forms 
        (student_id, registration_id, full_name, branch, roll_number, mobile, year_of_study, section) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [studentId, registrationId, full_name, branch, roll_number, mobile, year_of_study, section || null]
    );

    return {
      status: 'created',
      message: 'Form submitted successfully',
      formId: result.insertId,
      registrationId: registrationId
    };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      if (error.message.includes('roll_number')) {
        throw new Error('This roll number is already registered');
      }
    }
    throw error;
  }
}

// Get student form by student ID
export async function getStudentForm(studentId) {
  const [rows] = await pool.query(
    'SELECT * FROM student_forms WHERE student_id = ?',
    [studentId]
  );
  return rows[0] || null;
}

// Get student by ID
export async function getStudentById(studentId) {
  const [rows] = await pool.query(
    'SELECT * FROM students WHERE id = ?',
    [studentId]
  );
  return rows[0] || null;
}
