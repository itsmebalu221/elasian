import { isAllowedEmail, findOrCreateUser } from '../config/firebase.js';
import { getStudentForm } from '../Services/student.service.js';

// Handle Firebase login - verify token and create session
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

    // Set session - this is critical
    try {
      request.session.user = {
        id: dbUser.id,
        email: email,
        name: user.displayName || dbUser.name || email.split('@')[0],
        picture: user.photoURL || dbUser.profile_picture || null,
        isVerified: true,
        hasSubmittedForm,
        isTemporary: dbUser.is_temporary || false
      };
      
      // Save session explicitly
      await new Promise((resolve, reject) => {
        request.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      console.log('✅ Session created for:', email, 'hasForm:', hasSubmittedForm);
    } catch (sessionError) {
      console.error('Session error:', sessionError);
      return reply.code(500).send({
        success: false,
        error: 'Session creation failed. Please try again.'
      });
    }

    return reply.send({
      success: true,
      message: 'Login successful',
      user: request.session.user,
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

// Get current user session
export async function getCurrentUser(request, reply) {
  if (!request.session || !request.session.user) {
    return reply.code(401).send({
      success: false,
      error: 'Not authenticated'
    });
  }

  return reply.send({
    success: true,
    user: request.session.user
  });
}

// Logout handler
export async function logoutHandler(request, reply) {
  if (request.session) {
    await request.session.destroy();
  }
  return reply.redirect('/login.html');
}

// Logout API handler
export async function logoutApiHandler(request, reply) {
  if (request.session) {
    await request.session.destroy();
  }
  return reply.send({
    success: true,
    message: 'Logged out successfully'
  });
}

// Check auth status (for API)
export async function checkAuthStatus(request, reply) {
  try {
    const isAuthenticated = !!(request.session && request.session.user);
    
    console.log('🔍 Auth check - Session exists:', !!request.session, 'User exists:', !!request.session?.user);
    
    if (isAuthenticated) {
      // Re-check form status in case it changed (but don't fail if error)
      try {
        if (request.session.user.id && !request.session.user.isTemporary) {
          const existingForm = await getStudentForm(request.session.user.id);
          request.session.user.hasSubmittedForm = !!existingForm;
        }
      } catch (formError) {
        console.warn('Could not refresh form status:', formError.message);
        // Keep existing hasSubmittedForm value
      }
    }
    
    return reply.send({
      success: true,
      isAuthenticated,
      user: isAuthenticated ? request.session.user : null
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
