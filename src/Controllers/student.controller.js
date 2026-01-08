import studentFormSchema from '../Schemas/student.schema.js';
import { submitStudentForm, getStudentForm } from '../Services/student.service.js';
import { signToken, getCookieName, getCookieOptions, sanitizeUserPayload } from '../utils/jwt.js';

// Helper to format Zod v4 errors
function formatZodErrors(zodError) {
  const errors = [];
  
  // Zod v4 uses 'issues' array
  if (zodError.issues && Array.isArray(zodError.issues)) {
    for (const issue of zodError.issues) {
      errors.push({
        field: issue.path ? issue.path.join('.') : 'unknown',
        message: issue.message || 'Validation error'
      });
    }
  } else if (zodError.errors && Array.isArray(zodError.errors)) {
    // Fallback for older format
    for (const err of zodError.errors) {
      errors.push({
        field: err.path ? err.path.join('.') : 'unknown',
        message: err.message || 'Validation error'
      });
    }
  }
  
  return errors.length > 0 ? errors : [{ field: 'form', message: 'Validation failed' }];
}

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

    console.log('Received form data:', JSON.stringify(req.body, null, 2));

    const parsed = studentFormSchema.safeParse(req.body);

    if (!parsed.success) {
      console.log('Validation failed:', JSON.stringify(parsed.error, null, 2));
      const errors = formatZodErrors(parsed.error);
      return res.status(400).json({
        success: false,
        errors
      });
    }

    console.log('Parsed data:', JSON.stringify(parsed.data, null, 2));

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
