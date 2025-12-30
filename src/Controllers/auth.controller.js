import { isAllowedEmail, findOrCreateUser } from '../config/firebase.js';
import { getStudentForm } from '../Services/student.service.js';

// Handle Firebase login - verify token and create session
export async function firebaseLoginHandler(request, reply) {
  try {
    const { user } = request.body;

    if (!user || !user.email) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid user data'
      });
    }

    // Check if email is from allowed domain
    if (!isAllowedEmail(user.email)) {
      return reply.code(403).send({
        success: false,
        error: 'Only @hitam.org email addresses are allowed'
      });
    }

    // Find or create user in database
    const dbUser = await findOrCreateUser({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL
    });

    // Check if user has already submitted a form
    const existingForm = await getStudentForm(dbUser.id);
    const hasSubmittedForm = !!existingForm;

    // Set session
    request.session.user = {
      id: dbUser.id,
      email: user.email,
      name: user.displayName,
      picture: user.photoURL,
      isVerified: true,
      hasSubmittedForm
    };

    return reply.send({
      success: true,
      message: 'Login successful',
      user: request.session.user,
      hasSubmittedForm,
      formData: existingForm
    });
  } catch (error) {
    console.error('Firebase login error:', error);
    return reply.code(500).send({
      success: false,
      error: 'Authentication failed. Please try again.'
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
  const isAuthenticated = !!(request.session && request.session.user);
  
  if (isAuthenticated) {
    // Re-check form status in case it changed
    const existingForm = await getStudentForm(request.session.user.id);
    request.session.user.hasSubmittedForm = !!existingForm;
  }
  
  return reply.send({
    success: true,
    isAuthenticated,
    user: isAuthenticated ? request.session.user : null
  });
}
