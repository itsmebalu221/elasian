import pool from '../db/mysql.js';

// Allowed email domain
const ALLOWED_DOMAIN = 'hitam.org';

// Verify if email belongs to allowed domain
export function isAllowedEmail(email) {
  if (!email) return false;
  return email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
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
  
  try {
    // Check if user exists
    const [rows] = await pool.query(
      'SELECT * FROM students WHERE google_id = ? OR email = ?',
      [googleId, email]
    );

    if (rows.length > 0) {
      // Update existing user
      await pool.query(
        'UPDATE students SET google_id = ?, name = ?, profile_picture = ?, is_verified = TRUE WHERE id = ?',
        [googleId, name, picture, rows[0].id]
      );
      return { ...rows[0], name, profile_picture: picture, is_verified: true };
    }

    // Create new user
    const [result] = await pool.query(
      'INSERT INTO students (google_id, email, name, profile_picture, is_verified) VALUES (?, ?, ?, ?, TRUE)',
      [googleId, email, name, picture]
    );

    return {
      id: result.insertId,
      google_id: googleId,
      email,
      name,
      profile_picture: picture,
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
