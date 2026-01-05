import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { EVENT_DEFINITIONS } from '../config/events.config.js';

dotenv.config();

const DB_NAME = process.env.DB_NAME || 'student_forms';

// Create MySQL connection pool WITHOUT database first (for creating DB)
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Pool with database selected
let pool = null;

// Initialize the pool with database
function createPool() {
  pool = mysql.createPool({
    ...poolConfig,
    database: DB_NAME
  });
  return pool;
}

// Initialize database and create tables
export async function initializeDatabase() {
  let connection = null;
  
  try {
    // Step 1: Connect without database to create it if needed
    console.log('🔄 Connecting to MySQL server...');
    const tempPool = mysql.createPool(poolConfig);
    connection = await tempPool.getConnection();
    
    // Step 2: Create database if not exists
    console.log(`🔄 Ensuring database '${DB_NAME}' exists...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE \`${DB_NAME}\``);
    
    // Step 3: Create students table
    console.log('🔄 Creating students table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS students (
        id INT AUTO_INCREMENT PRIMARY KEY,
        google_id VARCHAR(255) UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255),
        profile_picture VARCHAR(500),
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_google_id (google_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Step 4: Create student_forms table
    console.log('🔄 Creating student_forms table...');
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
        selected_events JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        INDEX idx_student_id (student_id),
        INDEX idx_roll_number (roll_number),
        INDEX idx_registration_id (registration_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Step 5: Create events catalog table
    console.log('🔄 Creating events table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS events (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type ENUM('MULTI_DAY','DAY_1_ONLY','DAY_2_ONLY','OPTIONAL') NOT NULL,
        day_label VARCHAR(50),
        start_time VARCHAR(20),
        end_time VARCHAR(20),
        venue VARCHAR(255),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_type (type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      ALTER TABLE events
        MODIFY COLUMN type ENUM('MULTI_DAY','DAY_1_ONLY','DAY_2_ONLY','OPTIONAL') NOT NULL
    `);

    // Step 6: Create event registrations table
    console.log('🔄 Creating event_registrations table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS event_registrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL,
        form_id INT NOT NULL,
        event_id VARCHAR(50) NOT NULL,
        selection_type ENUM('MULTI_DAY','DAY_1_ONLY','DAY_2_ONLY','OPTIONAL') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (form_id) REFERENCES student_forms(id) ON DELETE CASCADE,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        UNIQUE KEY uniq_student_event (student_id, event_id),
        INDEX idx_event_id (event_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      ALTER TABLE event_registrations
        MODIFY COLUMN selection_type ENUM('MULTI_DAY','DAY_1_ONLY','DAY_2_ONLY','OPTIONAL') NOT NULL
    `);

    // Step 7: Create payments table
    console.log('🔄 Creating payments table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(50) UNIQUE NOT NULL,
        student_id INT NOT NULL,
        form_id INT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        status ENUM('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED') DEFAULT 'PENDING',
        cf_order_id VARCHAR(100),
        cf_payment_id VARCHAR(100),
        payment_session_id VARCHAR(255),
        payment_method VARCHAR(50),
        paid_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (form_id) REFERENCES student_forms(id) ON DELETE CASCADE,
        INDEX idx_order_id (order_id),
        INDEX idx_student_id (student_id),
        INDEX idx_form_id (form_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Step 8: Add any missing columns to existing tables
    console.log('🔄 Ensuring student_forms has selected_events column...');
    const [selectedEventsColumn] = await connection.query(
      "SHOW COLUMNS FROM student_forms LIKE 'selected_events'"
    );
    if (selectedEventsColumn.length === 0) {
      await connection.query(
        "ALTER TABLE student_forms ADD COLUMN selected_events JSON NULL AFTER address"
      );
      console.log('  ✓ Added selected_events column to student_forms');
    }

    // Step 9: Generate registration IDs for existing records
    console.log('🔄 Checking registration IDs...');
    const [rowsWithoutId] = await connection.query(
      'SELECT id FROM student_forms WHERE registration_id IS NULL'
    );
    
    for (const row of rowsWithoutId) {
      const regId = 'HITAM' + new Date().getFullYear().toString().slice(-2) + String(row.id).padStart(6, '0');
      await connection.query('UPDATE student_forms SET registration_id = ? WHERE id = ?', [regId, row.id]);
      console.log(`  ✓ Generated registration ID: ${regId}`);
    }

    // Step 10: Seed events catalog (idempotent)
    console.log('🔄 Seeding events catalog...');
    for (const event of EVENT_DEFINITIONS) {
      await connection.query(
        `INSERT INTO events (id, name, type, day_label, start_time, end_time, venue, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           type = VALUES(type),
           day_label = VALUES(day_label),
           start_time = VALUES(start_time),
           end_time = VALUES(end_time),
           venue = VALUES(venue),
           description = VALUES(description)`
        , [
          event.id,
          event.name,
          event.type,
          event.dayLabel || null,
          event.startTime || null,
          event.endTime || null,
          event.venue || null,
          event.description || null
        ]
      );
    }

    connection.release();
    await tempPool.end();
    
    // Create the main pool with database selected
    createPool();
    
    console.log('✅ Database initialized successfully!');
    console.log(`   Database: ${DB_NAME}`);
    console.log('   Tables: students, student_forms, events, event_registrations');
    
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('   Make sure MySQL server is running!');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   Check your database username and password in .env file');
    }
    
    if (connection) {
      try { connection.release(); } catch (e) {}
    }
    throw error;
  }
}

// Get pool (create if not exists)
export function getPool() {
  if (!pool) {
    createPool();
  }
  return pool;
}

export default {
  query: (...args) => getPool().query(...args),
  getConnection: () => getPool().getConnection(),
  end: () => pool ? pool.end() : Promise.resolve()
};
