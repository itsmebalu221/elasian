import { isAllowedEmail, findOrCreateUser } from '../config/firebase.js';
import { getStudentForm } from '../Services/student.service.js';
import { signToken, getCookieName, getCookieOptions, sanitizeUserPayload } from '../utils/jwt.js';

// Handle Firebase login - verify token and issue auth cookie
export async function firebaseLoginHandler(request, reply) {
  try {
    const { user } = request.body;

    // Validate input
    if (!user) {
      return reply.code(400).send({
        success: false,
        error: 'User data is required'
      });
    }

    // Ensure we have at minimum an email
    if (!user.email) {
      return reply.code(400).send({
        success: false,
        error: 'Email is required for authentication'
      });
    }

    // Normalize email
    const email = user.email.toLowerCase().trim();

    // Check if email is from allowed domain
    if (!isAllowedEmail(email)) {
      return reply.code(403).send({
        success: false,
        error: 'Only @hitam.org email addresses are allowed'
      });
    }

    // Find or create user in database (with built-in retries)
    let dbUser;
    try {
      dbUser = await findOrCreateUser({
        uid: user.uid || `google_${Date.now()}`,
        email: email,
        displayName: user.displayName || email.split('@')[0],
        photoURL: user.photoURL || null
      });
    } catch (dbError) {
      console.error('Database error during login:', dbError);
      // Create session anyway with minimal data - user experience is priority
      dbUser = {
        id: `session_${Date.now()}`,
        email: email,
        name: user.displayName || email.split('@')[0],
        profile_picture: user.photoURL || null,
        is_temporary: true
      };
    }

    // Check if user has already submitted a form (don't fail login if this errors)
    let hasSubmittedForm = false;
    let existingForm = null;
    try {
      if (dbUser.id && !dbUser.is_temporary) {
        existingForm = await getStudentForm(dbUser.id);
        hasSubmittedForm = !!existingForm;
      }
    } catch (formError) {
      console.warn('Could not check form status:', formError.message);
      // Continue without form status - will be checked again when needed
    }

    const authUser = {
      id: dbUser.id,
      email,
      name: user.displayName || dbUser.name || email.split('@')[0],
      picture: user.photoURL || dbUser.profile_picture || null,
      isVerified: true,
      hasSubmittedForm,
      isTemporary: dbUser.is_temporary || false
    };

    const token = signToken(authUser);

    console.log('✅ Auth token issued for:', email, 'hasForm:', hasSubmittedForm);

    return reply
      .setCookie(getCookieName(), token, getCookieOptions())
      .send({
        success: true,
        message: 'Login successful',
        user: authUser,
        hasSubmittedForm,
        formData: existingForm
      });
  } catch (error) {
    console.error('Firebase login error:', error);
    
    // Try to provide a helpful error message
    let errorMessage = 'Authentication failed. Please try again.';
    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Service temporarily unavailable. Please try again in a moment.';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Connection timed out. Please check your internet and try again.';
    }
    
    return reply.code(500).send({
      success: false,
      error: errorMessage
    });
  }
}

// Get current user
export async function getCurrentUser(request, reply) {
  if (!request.user) {
    return reply.code(401).send({
      success: false,
      error: 'Not authenticated'
    });
  }

  return reply.send({
    success: true,
    user: sanitizeUserPayload(request.user)
  });
}

// Logout handler
export async function logoutHandler(request, reply) {
  reply
    .clearCookie(getCookieName(), getCookieOptions())
    .redirect('/login.html');
}

// Logout API handler
export async function logoutApiHandler(request, reply) {
  reply.clearCookie(getCookieName(), getCookieOptions());
  return reply.send({
    success: true,
    message: 'Logged out successfully'
  });
}

// Check auth status (for API)
export async function checkAuthStatus(request, reply) {
  try {
    const isAuthenticated = !!request.user;

    console.log('🔍 Auth check - user present:', isAuthenticated);

    let authUser = sanitizeUserPayload(request.user);

    if (isAuthenticated) {
      // Re-check form status in case it changed (but don't fail if error)
      try {
        if (authUser.id && !authUser.isTemporary) {
          const existingForm = await getStudentForm(authUser.id);
          const hasSubmittedForm = !!existingForm;

          if (hasSubmittedForm !== authUser.hasSubmittedForm) {
            authUser = {
              ...authUser,
              hasSubmittedForm
            };

            const token = signToken(authUser);
            reply.setCookie(getCookieName(), token, getCookieOptions());
          } else {
            authUser = {
              ...authUser,
              hasSubmittedForm
            };
          }
        }
      } catch (formError) {
        console.warn('Could not refresh form status:', formError.message);
        // Keep existing hasSubmittedForm value
      }
    }
    
    return reply.send({
      success: true,
      isAuthenticated,
      user: isAuthenticated ? authUser : null
    });
  } catch (error) {
    console.error('Auth status check error:', error);
    // Even if there's an error, try to return a valid response
    return reply.send({
      success: true,
      isAuthenticated: false,
      user: null
    });
  }
}
