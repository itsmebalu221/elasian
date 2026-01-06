import pool from '../db/mysql.js';

// Allowed email domain for HITAM internal students
const HITAM_DOMAIN = 'hitam.org';

// Verify if email belongs to HITAM domain
export function isHitamEmail(email) {
  if (!email) return false;
  return email.toLowerCase().endsWith(`@${HITAM_DOMAIN}`);
}

// Determine user type based on email
export function getUserType(email) {
  return isHitamEmail(email) ? 'HITAMONLY' : 'EXTERNAL';
}

// Google OAuth configuration
export const googleOAuthConfig = {
  name: 'googleOAuth2',
  scope: ['profile', 'email'],
  credentials: {
    client: {
      id: process.env.GOOGLE_CLIENT_ID,
      secret: process.env.GOOGLE_CLIENT_SECRET
    },
    auth: {
      authorizeHost: 'https://accounts.google.com',
      authorizePath: '/o/oauth2/v2/auth',
      tokenHost: 'https://oauth2.googleapis.com',
      tokenPath: '/token'
    }
  },
  startRedirectPath: '/auth/google',
  callbackUri: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback'
};

// Find or create user in database
export async function findOrCreateUser(profile) {
  const { id: googleId, email, name, picture } = profile;
  const userType = getUserType(email);
  
  try {
    // Check if user exists
    const [rows] = await pool.query(
      'SELECT * FROM students WHERE google_id = ? OR email = ?',
      [googleId, email]
    );

    if (rows.length > 0) {
      // Update existing user
      await pool.query(
        'UPDATE students SET google_id = ?, name = ?, profile_picture = ?, user_type = ?, is_verified = TRUE WHERE id = ?',
        [googleId, name, picture, userType, rows[0].id]
      );
      return { ...rows[0], name, profile_picture: picture, user_type: userType, is_verified: true };
    }

    // Create new user
    const [result] = await pool.query(
      'INSERT INTO students (google_id, email, name, profile_picture, user_type, is_verified) VALUES (?, ?, ?, ?, ?, TRUE)',
      [googleId, email, name, picture, userType]
    );

    return {
      id: result.insertId,
      google_id: googleId,
      email,
      name,
      profile_picture: picture,
      user_type: userType,
      is_verified: true
    };
  } catch (error) {
    console.error('Database error in findOrCreateUser:', error);
    throw error;
  }
}

// Get user profile from Google
export async function getGoogleProfile(accessToken) {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch Google profile');
  }
  
  return response.json();
}
