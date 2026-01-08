import studentFormSchema from '../Schemas/student.schema.js';
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

    // Block form submission for temporary users (database connection failed during auth)
    if (user.isTemporary) {
      return res.status(503).json({
        success: false,
        error: 'Service temporarily unavailable. Please try logging in again.'
      });
    }

    const studentId = user.id;

    const parsed = studentFormSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        errors: parsed.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    }

    const result = await submitStudentForm(studentId, parsed.data);

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
