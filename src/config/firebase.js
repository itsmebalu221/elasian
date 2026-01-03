import pool from '../db/mysql.js';

// Allowed email domain
const ALLOWED_DOMAIN = 'hitam.org';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

// Helper: Sleep for retry delays
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Verify if email belongs to allowed domain
export function isAllowedEmail(email) {
  if (!email) return false;
  return email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

// Find or create user in database with retry logic
export async function findOrCreateUser(profile) {
  const { uid: firebaseUid, email, displayName, photoURL } = profile;
  
  let lastError = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Check if user exists
      const [rows] = await pool.query(
        'SELECT * FROM students WHERE google_id = ? OR email = ?',
        [firebaseUid, email]
      );

      if (rows.length > 0) {
        // Update existing user - don't fail if update fails
        try {
          await pool.query(
            'UPDATE students SET google_id = ?, name = ?, profile_picture = ?, is_verified = TRUE WHERE id = ?',
            [firebaseUid, displayName || rows[0].name, photoURL || rows[0].profile_picture, rows[0].id]
          );
        } catch (updateErr) {
          console.warn('Non-critical: Could not update user profile:', updateErr.message);
        }
        return { 
          ...rows[0], 
          name: displayName || rows[0].name, 
          profile_picture: photoURL || rows[0].profile_picture, 
          is_verified: true 
        };
      }

      // Create new user
      const [result] = await pool.query(
        'INSERT INTO students (google_id, email, name, profile_picture, is_verified) VALUES (?, ?, ?, ?, TRUE)',
        [firebaseUid, email, displayName || 'User', photoURL || null]
      );

      return {
        id: result.insertId,
        google_id: firebaseUid,
        email,
        name: displayName || 'User',
        profile_picture: photoURL,
        is_verified: true
      };
    } catch (error) {
      lastError = error;
      console.error(`Database attempt ${attempt}/${MAX_RETRIES} failed:`, error.message);
      
      // Check if it's a duplicate key error (user was created by another request)
      if (error.code === 'ER_DUP_ENTRY') {
        // Try to fetch the existing user
        try {
          const [existing] = await pool.query(
            'SELECT * FROM students WHERE email = ?',
            [email]
          );
          if (existing.length > 0) {
            return existing[0];
          }
        } catch (fetchErr) {
          console.error('Failed to fetch existing user:', fetchErr.message);
        }
      }
      
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY * attempt); // Exponential backoff
      }
    }
  }
  
  // All retries failed - create a temporary in-memory user for this session
  console.error('All database attempts failed, using fallback user');
  return {
    id: `temp_${Date.now()}`,
    google_id: firebaseUid,
    email,
    name: displayName || 'User',
    profile_picture: photoURL,
    is_verified: true,
    is_temporary: true
  };
}
