import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { EVENT_DEFINITIONS } from '../config/events.config.js';

dotenv.config();

const DB_NAME = process.env.DB_NAME || 'student_forms';
const BRANCH_OPTIONS = ['CSE', 'EEE', 'ECE', 'MECH', 'CSC', 'CSD', 'CSO', 'CSM', 'ITP'];
const DEFAULT_BRANCH = BRANCH_OPTIONS[0];

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
        payment_status ENUM('PENDING','PAID','FAILED') DEFAULT 'PENDING',
        payment_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        INDEX idx_student_id (student_id),
        INDEX idx_roll_number (roll_number),
        INDEX idx_registration_id (registration_id),
        INDEX idx_payment_status (payment_status)
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

    // Step 7: Create external registrations table
    console.log('🔄 Creating external_registrations table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS external_registrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        registration_id VARCHAR(25) UNIQUE,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        mobile VARCHAR(15) NOT NULL,
        institution VARCHAR(255) NOT NULL,
        department VARCHAR(255) NOT NULL,
        year_of_study INT NOT NULL,
        identity_number VARCHAR(100) NOT NULL UNIQUE,
        add_on_selected BOOLEAN DEFAULT FALSE,
        total_amount DECIMAL(10, 2) NOT NULL,
        selected_events JSON NULL,
        payment_status ENUM('PENDING','PAID','FAILED') DEFAULT 'PENDING',
        payment_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_external_email (email),
        INDEX idx_external_mobile (mobile),
        INDEX idx_external_payment_status (payment_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Step 7b: Create butterfly registrations table (4-student group offer)
    console.log('🔄 Creating butterfly_registrations table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS butterfly_registrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        registration_id VARCHAR(25) UNIQUE,
        primary_email VARCHAR(255) NOT NULL,
        student1_name VARCHAR(255) NOT NULL,
        student1_branch VARCHAR(100) NOT NULL,
        student1_roll_number VARCHAR(50) NOT NULL,
        student1_mobile VARCHAR(15) NOT NULL,
        student1_email VARCHAR(255) NOT NULL,
        student2_name VARCHAR(255) NOT NULL,
        student2_branch VARCHAR(100) NOT NULL,
        student2_roll_number VARCHAR(50) NOT NULL,
        student2_mobile VARCHAR(15) NOT NULL,
        student2_email VARCHAR(255) NOT NULL,
        student3_name VARCHAR(255) NOT NULL,
        student3_branch VARCHAR(100) NOT NULL,
        student3_roll_number VARCHAR(50) NOT NULL,
        student3_mobile VARCHAR(15) NOT NULL,
        student3_email VARCHAR(255) NOT NULL,
        student4_name VARCHAR(255) NOT NULL,
        student4_branch VARCHAR(100) NOT NULL,
        student4_roll_number VARCHAR(50) NOT NULL,
        student4_mobile VARCHAR(15) NOT NULL,
        student4_email VARCHAR(255) NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL DEFAULT 1800.00,
        payment_status ENUM('PENDING','PAID','FAILED') DEFAULT 'PENDING',
        payment_id INT NULL,
        qr_codes JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_butterfly_primary_email (primary_email),
        INDEX idx_butterfly_payment_status (payment_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Step 7c: Create alumni registrations table
    console.log('🔄 Creating alumni_registrations table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS alumni_registrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        registration_id VARCHAR(25) UNIQUE,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        mobile VARCHAR(15) NOT NULL,
        branch VARCHAR(100) NOT NULL,
        year_of_graduation INT NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL DEFAULT 800.00,
        payment_status ENUM('PENDING','PAID','FAILED') DEFAULT 'PENDING',
        payment_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_alumni_email (email),
        INDEX idx_alumni_payment_status (payment_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Step 8: Create payments table
    console.log('🔄 Creating payments table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(50) UNIQUE NOT NULL,
        student_id INT NULL,
        form_id INT NULL,
        external_registration_id INT NULL,
        butterfly_registration_id INT NULL,
        alumni_registration_id INT NULL,
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
        FOREIGN KEY (external_registration_id) REFERENCES external_registrations(id) ON DELETE CASCADE,
        FOREIGN KEY (butterfly_registration_id) REFERENCES butterfly_registrations(id) ON DELETE CASCADE,
        FOREIGN KEY (alumni_registration_id) REFERENCES alumni_registrations(id) ON DELETE CASCADE,
        INDEX idx_order_id (order_id),
        INDEX idx_student_id (student_id),
        INDEX idx_form_id (form_id),
        INDEX idx_external_registration (external_registration_id),
        INDEX idx_butterfly_registration (butterfly_registration_id),
        INDEX idx_alumni_registration (alumni_registration_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Step 9: Add any missing columns to existing tables
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

    console.log('🔄 Ensuring student_forms has payment status columns...');
    const [paymentStatusColumn] = await connection.query(
      "SHOW COLUMNS FROM student_forms LIKE 'payment_status'"
    );
    if (paymentStatusColumn.length === 0) {
      await connection.query(
        "ALTER TABLE student_forms ADD COLUMN payment_status ENUM('PENDING','PAID','FAILED') DEFAULT 'PENDING' AFTER selected_events"
      );
      console.log('  ✓ Added payment_status column to student_forms');
    }

    const [paymentIdColumn] = await connection.query(
      "SHOW COLUMNS FROM student_forms LIKE 'payment_id'"
    );
    if (paymentIdColumn.length === 0) {
      await connection.query(
        'ALTER TABLE student_forms ADD COLUMN payment_id INT NULL AFTER payment_status'
      );
      console.log('  ✓ Added payment_id column to student_forms');
    }

    const [paymentStatusIndex] = await connection.query(
      "SHOW INDEX FROM student_forms WHERE Key_name = 'idx_payment_status'"
    );
    if (paymentStatusIndex.length === 0) {
      await connection.query(
        'ALTER TABLE student_forms ADD INDEX idx_payment_status (payment_status)'
      ).catch(() => { });
    }

    console.log('🔄 Normalizing student form branch and section data...');
    const branchPlaceholders = BRANCH_OPTIONS.map(() => '?').join(',');
    const branchParams = [DEFAULT_BRANCH, ...BRANCH_OPTIONS];
    await connection.query(
      `UPDATE student_forms SET branch = ?
       WHERE branch IS NULL OR branch = '' OR UPPER(branch) NOT IN (${branchPlaceholders})`,
      branchParams
    ).catch((err) => {
      console.warn('  ⚠️ Could not normalize branch values:', err.message);
    });
    await connection.query(
      'UPDATE student_forms SET branch = UPPER(branch) WHERE branch IS NOT NULL'
    ).catch((err) => {
      console.warn('  ⚠️ Could not standardize branch casing:', err.message);
    });
    await connection.query(
      'UPDATE student_forms SET section = NULL WHERE section IS NOT NULL'
    ).catch((err) => {
      console.warn('  ⚠️ Could not clear legacy section values:', err.message);
    });

    // Ensure students table has user_type column with HITAMONLY/EXTERNAL values
    console.log('🔄 Ensuring students table has user_type column...');
    const [userTypeColumn] = await connection.query(
      "SHOW COLUMNS FROM students LIKE 'user_type'"
    );
    if (userTypeColumn.length === 0) {
      await connection.query(
        "ALTER TABLE students ADD COLUMN user_type ENUM('HITAMONLY', 'EXTERNAL') DEFAULT 'HITAMONLY' AFTER is_verified"
      );
      console.log('  ✓ Added user_type column to students');
    } else {
      await connection.query(
        "ALTER TABLE students MODIFY COLUMN user_type ENUM('INTERNAL', 'HITAMONLY', 'EXTERNAL') DEFAULT 'INTERNAL'"
      ).catch(() => { });
    }

    await connection.query(
      "UPDATE students SET user_type = 'HITAMONLY' WHERE user_type = 'INTERNAL'"
    ).catch(() => { });

    await connection.query(
      "ALTER TABLE students MODIFY COLUMN user_type ENUM('HITAMONLY', 'EXTERNAL') DEFAULT 'HITAMONLY'"
    ).catch((err) => {
      console.warn('  ⚠️ Could not finalize user_type enum update:', err.message);
    });

    console.log('🔄 Ensuring payments table supports external registrations...');
    await connection.query('ALTER TABLE payments MODIFY COLUMN student_id INT NULL').catch(() => { });
    await connection.query('ALTER TABLE payments MODIFY COLUMN form_id INT NULL').catch(() => { });

    const [externalRegistrationColumn] = await connection.query(
      "SHOW COLUMNS FROM payments LIKE 'external_registration_id'"
    );
    if (externalRegistrationColumn.length === 0) {
      await connection.query(
        'ALTER TABLE payments ADD COLUMN external_registration_id INT NULL AFTER form_id'
      );
      await connection.query(
        'ALTER TABLE payments ADD INDEX idx_external_registration (external_registration_id)'
      ).catch(() => { });
    }

    try {
      // Check if foreign key already exists before trying to add it
      const [existingFk] = await connection.query(`
        SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'payments' 
        AND CONSTRAINT_NAME = 'fk_payments_external_registration'
      `, [DB_NAME]);

      if (existingFk.length === 0) {
        await connection.query(
          'ALTER TABLE payments ADD CONSTRAINT fk_payments_external_registration FOREIGN KEY (external_registration_id) REFERENCES external_registrations(id) ON DELETE CASCADE'
        );
        console.log('  ✓ Added external registration foreign key');
      }
    } catch (err) {
      // Silently ignore if constraint already exists
      if (!err.message.includes('Duplicate') && err.code !== 'ER_FK_ALREADY_EXISTS' && err.code !== 'ER_DUP_KEYNAME') {
        console.warn('  ⚠️ Could not add external registration foreign key:', err.message);
      }
    }

    // Ensure payments table supports butterfly registrations
    console.log('🔄 Ensuring payments table supports butterfly registrations...');
    const [butterflyRegistrationColumn] = await connection.query(
      "SHOW COLUMNS FROM payments LIKE 'butterfly_registration_id'"
    );
    if (butterflyRegistrationColumn.length === 0) {
      await connection.query(
        'ALTER TABLE payments ADD COLUMN butterfly_registration_id INT NULL AFTER external_registration_id'
      );
      await connection.query(
        'ALTER TABLE payments ADD INDEX idx_butterfly_registration (butterfly_registration_id)'
      ).catch(() => { });
    }

    try {
      const [existingButterflyFk] = await connection.query(`
        SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'payments' 
        AND CONSTRAINT_NAME = 'fk_payments_butterfly_registration'
      `, [DB_NAME]);

      if (existingButterflyFk.length === 0) {
        await connection.query(
          'ALTER TABLE payments ADD CONSTRAINT fk_payments_butterfly_registration FOREIGN KEY (butterfly_registration_id) REFERENCES butterfly_registrations(id) ON DELETE CASCADE'
        );
        console.log('  ✓ Added butterfly registration foreign key');
      }
    } catch (err) {
      if (!err.message.includes('Duplicate') && err.code !== 'ER_FK_ALREADY_EXISTS' && err.code !== 'ER_DUP_KEYNAME') {
        console.warn('  ⚠️ Could not add butterfly registration foreign key:', err.message);
      }
    }

    // Ensure payments table supports alumni registrations
    console.log('🔄 Ensuring payments table supports alumni registrations...');
    const [alumniRegistrationColumn] = await connection.query(
      "SHOW COLUMNS FROM payments LIKE 'alumni_registration_id'"
    );
    if (alumniRegistrationColumn.length === 0) {
      await connection.query(
        'ALTER TABLE payments ADD COLUMN alumni_registration_id INT NULL AFTER butterfly_registration_id'
      );
      await connection.query(
        'ALTER TABLE payments ADD INDEX idx_alumni_registration (alumni_registration_id)'
      ).catch(() => { });
    }

    try {
      const [existingAlumniFk] = await connection.query(`
        SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'payments' 
        AND CONSTRAINT_NAME = 'fk_payments_alumni_registration'
      `, [DB_NAME]);

      if (existingAlumniFk.length === 0) {
        await connection.query(
          'ALTER TABLE payments ADD CONSTRAINT fk_payments_alumni_registration FOREIGN KEY (alumni_registration_id) REFERENCES alumni_registrations(id) ON DELETE CASCADE'
        );
        console.log('  ✓ Added alumni registration foreign key');
      }
    } catch (err) {
      if (!err.message.includes('Duplicate') && err.code !== 'ER_FK_ALREADY_EXISTS' && err.code !== 'ER_DUP_KEYNAME') {
        console.warn('  ⚠️ Could not add alumni registration foreign key:', err.message);
      }
    }

    // Step 10: Generate registration IDs for existing records
    console.log('🔄 Checking registration IDs...');
    const [rowsWithoutId] = await connection.query(
      'SELECT id FROM student_forms WHERE registration_id IS NULL'
    );

    for (const row of rowsWithoutId) {
      const regId = 'ELYSIAN' + new Date().getFullYear().toString().slice(-2) + String(row.id).padStart(6, '0');
      await connection.query('UPDATE student_forms SET registration_id = ? WHERE id = ?', [regId, row.id]);
      console.log(`  ✓ Generated registration ID: ${regId}`);
    }

    console.log('🔄 Updating legacy registration ID prefixes...');
    const [updatedPrefixes] = await connection.query(
      "UPDATE student_forms SET registration_id = CONCAT('ELYSIAN', SUBSTRING(registration_id, 6)) WHERE registration_id LIKE 'HITAM%'"
    );
    if (updatedPrefixes.affectedRows > 0) {
      console.log(`  ✓ Updated ${updatedPrefixes.affectedRows} registration IDs to ELYSIAN prefix`);
    }

    // Step 10: Seed events catalog (idempotent)
    console.log('🔄 Seeding events catalog...');

    // Remove deprecated events that are no longer in the catalog
    const currentEventIds = EVENT_DEFINITIONS.map(e => e.id);
    const placeholders = currentEventIds.map(() => '?').join(',');
    await connection.query(
      `DELETE FROM events WHERE id NOT IN (${placeholders}) AND id LIKE 'EVT_%'`,
      currentEventIds
    );

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
      try { connection.release(); } catch (e) { }
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
