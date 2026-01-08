import validateStudentForm from '../Schemas/student.schema.js';
import { submitStudentForm, getStudentForm } from '../Services/student.service.js';
import { signToken, getCookieName, getCookieOptions, sanitizeUserPayload } from '../utils/jwt.js';

export async function submitStudentFormHandler(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized. Please login with your HITAM email first.'
      });
    }

    const user = sanitizeUserPayload(req.user);
    const studentId = user.id;

    console.log('Received body:', JSON.stringify(req.body));

    const validation = validateStudentForm(req.body);

    console.log('Validation result:', JSON.stringify(validation));

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors
      });
    }

    const result = await submitStudentForm(studentId, validation.data);

    const updatedUser = {
      ...user,
      hasSubmittedForm: true
    };

    const token = signToken(updatedUser);
    res.cookie(getCookieName(), token, getCookieOptions());

    return res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Form submission error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

export async function getStudentFormHandler(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized. Please login first.'
      });
    }

    const studentId = sanitizeUserPayload(req.user).id;
    const form = await getStudentForm(studentId);

    if (!form) {
      return res.status(404).json({
        success: false,
        error: 'No form submitted yet'
      });
    }

    return res.json({
      success: true,
      data: form
    });
  } catch (error) {
    console.error('Get form error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
