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
  const inferredUserType = isAllowedEmail(email) ? 'HITAMONLY' : 'EXTERNAL';
  
  let lastError = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Check if user exists
      const [rows] = await pool.query(
        'SELECT * FROM students WHERE google_id = ? OR email = ?',
        [firebaseUid, email]
      );

      if (rows.length > 0) {
        const currentUser = rows[0];
        const resolvedType = inferredUserType;

        // Update existing user - don't fail if update fails
        try {
          await pool.query(
            'UPDATE students SET google_id = ?, name = ?, profile_picture = ?, user_type = ?, is_verified = TRUE WHERE id = ?',
            [
              firebaseUid,
              displayName || currentUser.name,
              photoURL || currentUser.profile_picture,
              resolvedType,
              currentUser.id
            ]
          );
        } catch (updateErr) {
          console.warn('Non-critical: Could not update user profile:', updateErr.message);
        }
        return {
          ...currentUser,
          name: displayName || currentUser.name,
          profile_picture: photoURL || currentUser.profile_picture,
          user_type: resolvedType,
          is_verified: true
        };
      }

      // Create new user
      const [result] = await pool.query(
        'INSERT INTO students (google_id, email, name, profile_picture, user_type, is_verified) VALUES (?, ?, ?, ?, ?, TRUE)',
        [firebaseUid, email, displayName || 'User', photoURL || null, inferredUserType]
      );

      return {
        id: result.insertId,
        google_id: firebaseUid,
        email,
        name: displayName || 'User',
        profile_picture: photoURL,
        user_type: inferredUserType,
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
            const existingUser = existing[0];
            const resolvedType = inferredUserType;

            if (existingUser.user_type !== resolvedType) {
              try {
                await pool.query(
                  'UPDATE students SET user_type = ? WHERE id = ?',
                  [resolvedType, existingUser.id]
                );
              } catch (updateErr) {
                console.warn('Non-critical: Could not normalize user type:', updateErr.message);
              }
            }

            return { ...existingUser, user_type: resolvedType };
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
    user_type: inferredUserType,
    is_verified: true,
    is_temporary: true
  };
}
