import pool from '../db/mysql.js';

// Allowed email domain
const ALLOWED_DOMAIN = 'hitam.org';

// Verify if email belongs to allowed domain
export function isAllowedEmail(email) {
  if (!email) return false;
  return email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

// Find or create user in database
export async function findOrCreateUser(profile) {
  const { uid: firebaseUid, email, displayName, photoURL } = profile;
  
  try {
    // Check if user exists
    const [rows] = await pool.query(
      'SELECT * FROM students WHERE google_id = ? OR email = ?',
      [firebaseUid, email]
    );

    if (rows.length > 0) {
      // Update existing user
      await pool.query(
        'UPDATE students SET google_id = ?, name = ?, profile_picture = ?, is_verified = TRUE WHERE id = ?',
        [firebaseUid, displayName, photoURL, rows[0].id]
      );
      return { ...rows[0], name: displayName, profile_picture: photoURL, is_verified: true };
    }

    // Create new user
    const [result] = await pool.query(
      'INSERT INTO students (google_id, email, name, profile_picture, is_verified) VALUES (?, ?, ?, ?, TRUE)',
      [firebaseUid, email, displayName, photoURL]
    );

    return {
      id: result.insertId,
      google_id: firebaseUid,
      email,
      name: displayName,
      profile_picture: photoURL,
      is_verified: true
    };
  } catch (error) {
    console.error('Database error in findOrCreateUser:', error);
    throw error;
  }
}
