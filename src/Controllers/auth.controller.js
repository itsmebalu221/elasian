import { getUserType } from '../config/passport.js';
import { findOrCreateUser } from '../config/firebase.js';
import { getStudentForm } from '../Services/student.service.js';
import { getExternalRegistrationByEmail } from '../Services/external.service.js';
import { getAlumniRegistrationByEmail } from '../Services/alumni.service.js';
import { signToken, getCookieName, getCookieOptions, getClearCookieOptions, sanitizeUserPayload } from '../utils/jwt.js';

export async function firebaseLoginHandler(req, res) {
  try {
    const { user, loginType } = req.body || {};

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
    const loginFlow = (loginType || '').toString().toLowerCase();
    const isAlumniLogin = loginFlow === 'alumni';
    const detectedUserType = getUserType(email);

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
    const normalizedDbType =
      dbUser.user_type === 'INTERNAL' ? 'HITAMONLY' : dbUser.user_type;

    // HITAMONLY registrations are closed - treat as EXTERNAL unless they already have a form
    let resolvedUserType = isAlumniLogin
      ? 'ALUMNI'
      : (normalizedDbType || detectedUserType);

    try {
      if (dbUser.id && !dbUser.is_temporary) {
        if (resolvedUserType === 'ALUMNI') {
          existingForm = await getAlumniRegistrationByEmail(email);
        } else if (resolvedUserType === 'HITAMONLY') {
          // Check if they have an existing HITAM student form
          existingForm = await getStudentForm(dbUser.id);
          // If no existing form, treat as EXTERNAL since HITAMONLY registrations are closed
          if (!existingForm) {
            resolvedUserType = 'EXTERNAL';
            existingForm = await getExternalRegistrationByEmail(email);
          }
        } else {
          existingForm = await getExternalRegistrationByEmail(email);
        }

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
      userType: resolvedUserType,
      isVerified: true,
      hasSubmittedForm,
      isTemporary: dbUser.is_temporary || false
    };

    const token = signToken(authUser);

    console.log('✅ Auth token issued for:', email, 'Type:', authUser.userType, 'hasForm:', hasSubmittedForm);

    res.cookie(getCookieName(), token, getCookieOptions());
    return res.json({
      success: true,
      message: 'Login successful',
      user: authUser,
      userType: authUser.userType,
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
  res.clearCookie(getCookieName(), getClearCookieOptions());
  return res.redirect('/login.html');
}

export async function logoutApiHandler(req, res) {
  res.clearCookie(getCookieName(), getClearCookieOptions());
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

    if (authUser?.userType === 'INTERNAL') {
      authUser = {
        ...authUser,
        userType: 'HITAMONLY'
      };

      const token = signToken(authUser);
      res.cookie(getCookieName(), token, getCookieOptions());
    }

    if (isAuthenticated && authUser) {
      try {
        if (authUser.id && !authUser.isTemporary) {
          let existingForm = null;

          if (authUser.userType === 'ALUMNI') {
            existingForm = await getAlumniRegistrationByEmail(authUser.email);
          } else if (authUser.userType === 'HITAMONLY') {
            // HITAM students - check student_forms table
            existingForm = await getStudentForm(authUser.id);
            // If no existing form, treat as EXTERNAL since HITAMONLY registrations are closed
            if (!existingForm) {
              authUser = {
                ...authUser,
                userType: 'EXTERNAL'
              };
              existingForm = await getExternalRegistrationByEmail(authUser.email);
            }
          } else {
            // External users - check external_registrations table by email
            existingForm = await getExternalRegistrationByEmail(authUser.email);
          }

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
