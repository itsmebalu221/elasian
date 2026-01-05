import { isAllowedEmail, findOrCreateUser } from '../config/firebase.js';
import { getStudentForm } from '../Services/student.service.js';
import { signToken, getCookieName, getCookieOptions, sanitizeUserPayload } from '../utils/jwt.js';

export async function firebaseLoginHandler(req, res) {
  try {
    const { user } = req.body;

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'User data is required'
      });
    }

    if (!user.email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required for authentication'
      });
    }

    const email = user.email.toLowerCase().trim();

    if (!isAllowedEmail(email)) {
      return res.status(403).json({
        success: false,
        error: 'Only @hitam.org email addresses are allowed'
      });
    }

    let dbUser;
    try {
      dbUser = await findOrCreateUser({
        uid: user.uid || `google_${Date.now()}`,
        email,
        displayName: user.displayName || email.split('@')[0],
        photoURL: user.photoURL || null
      });
    } catch (dbError) {
      console.error('Database error during login:', dbError);
      dbUser = {
        id: `session_${Date.now()}`,
        email,
        name: user.displayName || email.split('@')[0],
        profile_picture: user.photoURL || null,
        is_temporary: true
      };
    }

    let hasSubmittedForm = false;
    let existingForm = null;
    try {
      if (dbUser.id && !dbUser.is_temporary) {
        existingForm = await getStudentForm(dbUser.id);
        hasSubmittedForm = !!existingForm;
      }
    } catch (formError) {
      console.warn('Could not check form status:', formError.message);
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

    res.cookie(getCookieName(), token, getCookieOptions());
    return res.json({
      success: true,
      message: 'Login successful',
      user: authUser,
      hasSubmittedForm,
      formData: existingForm
    });
  } catch (error) {
    console.error('Firebase login error:', error);

    let errorMessage = 'Authentication failed. Please try again.';
    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Service temporarily unavailable. Please try again in a moment.';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Connection timed out. Please check your internet and try again.';
    }

    return res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
}

export async function getCurrentUser(req, res) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Not authenticated'
    });
  }

  return res.json({
    success: true,
    user: sanitizeUserPayload(req.user)
  });
}

export async function logoutHandler(req, res) {
  res.clearCookie(getCookieName(), getCookieOptions());
  return res.redirect('/login.html');
}

export async function logoutApiHandler(req, res) {
  res.clearCookie(getCookieName(), getCookieOptions());
  return res.json({
    success: true,
    message: 'Logged out successfully'
  });
}

export async function checkAuthStatus(req, res) {
  try {
    const isAuthenticated = !!req.user;

    console.log('🔍 Auth check - user present:', isAuthenticated);

    let authUser = sanitizeUserPayload(req.user);

    if (isAuthenticated && authUser) {
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
            res.cookie(getCookieName(), token, getCookieOptions());
          } else {
            authUser = {
              ...authUser,
              hasSubmittedForm
            };
          }
        }
      } catch (formError) {
        console.warn('Could not refresh form status:', formError.message);
      }
    }

    return res.json({
      success: true,
      isAuthenticated,
      user: isAuthenticated ? authUser : null
    });
  } catch (error) {
    console.error('Auth status check error:', error);
    return res.json({
      success: true,
      isAuthenticated: false,
      user: null
    });
  }
}
