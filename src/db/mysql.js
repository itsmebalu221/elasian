import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Create MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'student_forms',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Initialize database and create tables
export async function initializeDatabase() {
  try {
    const connection = await pool.getConnection();
    
    // Create students table if not exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS students (
        id INT AUTO_INCREMENT PRIMARY KEY,
        google_id VARCHAR(255) UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255),
        profile_picture VARCHAR(500),
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create student_forms table if not exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS student_forms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL,
        registration_id VARCHAR(20) UNIQUE,
        full_name VARCHAR(255) NOT NULL,
        branch VARCHAR(100) NOT NULL,
        roll_number VARCHAR(50) NOT NULL UNIQUE,
        mobile VARCHAR(15) NOT NULL,
        year_of_study INT NOT NULL,
        section VARCHAR(10),
        father_name VARCHAR(255),
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )
    `);

    // Add registration_id column if it doesn't exist (for existing tables)
    try {
      await connection.query(`
        ALTER TABLE student_forms ADD COLUMN registration_id VARCHAR(20) UNIQUE AFTER student_id
      `);
    } catch (e) {
      // Column already exists, ignore
    }

    // Generate registration IDs for existing records that don't have one
    const [rowsWithoutId] = await connection.query(
      'SELECT id FROM student_forms WHERE registration_id IS NULL'
    );
    for (const row of rowsWithoutId) {
      const regId = 'HITAM' + new Date().getFullYear().toString().slice(-2) + String(row.id).padStart(6, '0');
      await connection.query('UPDATE student_forms SET registration_id = ? WHERE id = ?', [regId, row.id]);
    }

    connection.release();
    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
}

export default pool;
