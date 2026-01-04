import studentFormSchema from '../Schemas/student.schema.js';
import { submitStudentForm, getStudentForm } from '../Services/student.service.js';
import { signToken, getCookieName, getCookieOptions, sanitizeUserPayload } from '../utils/jwt.js';

// Submit student form
export async function submitStudentFormHandler(request, reply) {
  try {
    // Check if user is authenticated
    if (!request.user) {
      return reply.code(401).send({
        success: false,
        error: 'Unauthorized. Please login with your HITAM email first.'
      });
    }

    const user = sanitizeUserPayload(request.user);
    const studentId = user.id;

    // Validate form data
    const parsed = studentFormSchema.safeParse(request.body);
    
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        errors: parsed.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    }

    // Submit form to database
    const result = await submitStudentForm(studentId, parsed.data);

    const updatedUser = {
      ...user,
      hasSubmittedForm: true
    };

    const token = signToken(updatedUser);

    return reply
      .setCookie(getCookieName(), token, getCookieOptions())
      .code(201)
      .send({
        success: true,
        data: result
      });
  } catch (error) {
    console.error('Form submission error:', error);
    return reply.code(500).send({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

// Get current user's form
export async function getStudentFormHandler(request, reply) {
  try {
    if (!request.user) {
      return reply.code(401).send({
        success: false,
        error: 'Unauthorized. Please login first.'
      });
    }

    const studentId = sanitizeUserPayload(request.user).id;
    const form = await getStudentForm(studentId);

    if (!form) {
      return reply.code(404).send({
        success: false,
        error: 'No form submitted yet'
      });
    }

    return reply.send({
      success: true,
      data: form
    });
  } catch (error) {
    console.error('Get form error:', error);
    return reply.code(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
}
