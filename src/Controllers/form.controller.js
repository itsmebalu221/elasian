import { formSchema } from '../Schemas/form.schema.js';
import { processFormSubmission } from '../Services/form.service.js';
import { getExternalRegistrationByEmail } from '../Services/external.service.js';
import { getAlumniRegistrationByEmail } from '../Services/alumni.service.js';
import db from '../db/mysql.js';

export async function submitForm(req, res) {
  console.log('REQUEST BODY:', req.body);

  const parsed = formSchema.safeParse(req.body);
  console.log('PARSED RESULT:', parsed);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      errors: parsed.error.errors
    });
  }

  const result = await processFormSubmission(parsed.data);

  return res.json({
    success: true,
    data: result
  });
}

// Public pass lookup by email - returns pass details for paid registrations
export async function lookupPassByEmail(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check external registrations first
    const externalReg = await getExternalRegistrationByEmail(normalizedEmail);
    if (externalReg && externalReg.payment_status === 'PAID') {
      return res.json({
        success: true,
        type: 'external',
        registration: {
          registration_id: externalReg.registration_id,
          full_name: externalReg.full_name,
          email: externalReg.email,
          mobile: externalReg.mobile,
          institution: externalReg.institution,
          department: externalReg.department,
          total_amount: externalReg.total_amount,
          esparto_selected: externalReg.esparto_selected,
          sahitya_selected: externalReg.sahitya_selected,
          prasasti_selected: externalReg.prasasti_selected
        }
      });
    }

    // Check alumni registrations
    const alumniReg = await getAlumniRegistrationByEmail(normalizedEmail);
    if (alumniReg && alumniReg.payment_status === 'PAID') {
      return res.json({
        success: true,
        type: 'alumni',
        registration: {
          registration_id: alumniReg.registration_id,
          full_name: alumniReg.full_name,
          email: alumniReg.email,
          mobile: alumniReg.mobile,
          branch: alumniReg.branch,
          year_of_graduation: alumniReg.year_of_graduation,
          total_amount: alumniReg.total_amount
        }
      });
    }

    // Check student registrations (HITAM students)
    const [studentRows] = await db.query(
      `SELECT sf.*, s.email as student_email 
       FROM student_forms sf 
       JOIN students s ON sf.student_id = s.id 
       WHERE s.email = ? AND sf.payment_status = 'PAID'
       ORDER BY sf.created_at DESC LIMIT 1`,
      [normalizedEmail]
    );

    if (studentRows.length > 0) {
      const studentReg = studentRows[0];
      return res.json({
        success: true,
        type: 'student',
        registration: {
          registration_id: studentReg.registration_id,
          full_name: studentReg.full_name,
          email: studentReg.student_email,
          mobile: studentReg.mobile,
          branch: studentReg.branch,
          roll_number: studentReg.roll_number,
          total_amount: 650 // Fixed student amount
        }
      });
    }

    // Check butterfly registrations (4-student group pass)
    // Search by primary_email or any of the 4 student emails
    const [butterflyRows] = await db.query(
      `SELECT * FROM butterfly_registrations 
       WHERE payment_status = 'PAID' 
       AND (primary_email = ? OR student1_email = ? OR student2_email = ? OR student3_email = ? OR student4_email = ?)
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedEmail, normalizedEmail, normalizedEmail, normalizedEmail, normalizedEmail]
    );

    if (butterflyRows.length > 0) {
      const butterflyReg = butterflyRows[0];
      // Find which student matches the email to return that student's details
      let matchedStudent = null;
      if (butterflyReg.student1_email?.toLowerCase() === normalizedEmail) {
        matchedStudent = { name: butterflyReg.student1_name, branch: butterflyReg.student1_branch, roll_number: butterflyReg.student1_roll_number, mobile: butterflyReg.student1_mobile, email: butterflyReg.student1_email };
      } else if (butterflyReg.student2_email?.toLowerCase() === normalizedEmail) {
        matchedStudent = { name: butterflyReg.student2_name, branch: butterflyReg.student2_branch, roll_number: butterflyReg.student2_roll_number, mobile: butterflyReg.student2_mobile, email: butterflyReg.student2_email };
      } else if (butterflyReg.student3_email?.toLowerCase() === normalizedEmail) {
        matchedStudent = { name: butterflyReg.student3_name, branch: butterflyReg.student3_branch, roll_number: butterflyReg.student3_roll_number, mobile: butterflyReg.student3_mobile, email: butterflyReg.student3_email };
      } else if (butterflyReg.student4_email?.toLowerCase() === normalizedEmail) {
        matchedStudent = { name: butterflyReg.student4_name, branch: butterflyReg.student4_branch, roll_number: butterflyReg.student4_roll_number, mobile: butterflyReg.student4_mobile, email: butterflyReg.student4_email };
      } else {
        // primary_email matched, return first student
        matchedStudent = { name: butterflyReg.student1_name, branch: butterflyReg.student1_branch, roll_number: butterflyReg.student1_roll_number, mobile: butterflyReg.student1_mobile, email: butterflyReg.primary_email };
      }

      return res.json({
        success: true,
        type: 'butterfly',
        registration: {
          registration_id: butterflyReg.registration_id,
          full_name: matchedStudent.name,
          email: matchedStudent.email,
          mobile: matchedStudent.mobile,
          branch: matchedStudent.branch,
          roll_number: matchedStudent.roll_number,
          total_amount: butterflyReg.total_amount,
          group_type: 'Butterfly (4-Student Group Pass)'
        }
      });
    }

    // Check first_phase_registrations (earlier phase registrations - no payment needed)
    const [firstPhaseRows] = await db.query(
      `SELECT * FROM first_phase_registrations 
       WHERE email = ?
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedEmail]
    );

    if (firstPhaseRows.length > 0) {
      const firstPhaseReg = firstPhaseRows[0];
      return res.json({
        success: true,
        type: 'first_phase',
        registration: {
          registration_id: firstPhaseReg.registration_id,
          full_name: firstPhaseReg.full_name,
          email: firstPhaseReg.email,
          mobile: firstPhaseReg.mobile,
          roll_number: firstPhaseReg.roll_number,
          user_type: firstPhaseReg.user_type,
          total_amount: 0 // First phase was free
        }
      });
    }

    // Check flash_registrations (flash sale registrations)
    const [flashRows] = await db.query(
      `SELECT * FROM flash_registrations 
       WHERE email = ? AND payment_status = 'SUCCESS'
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedEmail]
    );

    if (flashRows.length > 0) {
      const flashReg = flashRows[0];
      return res.json({
        success: true,
        type: 'flash',
        registration: {
          registration_id: flashReg.registration_id,
          full_name: flashReg.full_name,
          email: flashReg.email,
          mobile: flashReg.phone,
          roll_number: flashReg.roll_number,
          branch: flashReg.branch,
          total_amount: flashReg.amount
        }
      });
    }

    // Check attendance_snapshot (consolidated view)
    const [attendanceRows] = await db.query(
      `SELECT * FROM attendance_snapshot 
       WHERE email = ?
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedEmail]
    );

    if (attendanceRows.length > 0) {
      const attendanceReg = attendanceRows[0];
      return res.json({
        success: true,
        type: attendanceReg.user_type?.toLowerCase() || 'registered',
        registration: {
          registration_id: attendanceReg.registration_id,
          full_name: attendanceReg.full_name,
          email: attendanceReg.email,
          mobile: attendanceReg.mobile,
          roll_number: attendanceReg.roll_number,
          user_type: attendanceReg.user_type,
          source: attendanceReg.source_table,
          total_amount: 0
        }
      });
    }

    // No paid registration found
    return res.status(404).json({
      success: false,
      error: 'No paid registration found for this email. Please complete payment first.'
    });

  } catch (error) {
    console.error('Pass lookup error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to lookup pass. Please try again.'
    });
  }
}
