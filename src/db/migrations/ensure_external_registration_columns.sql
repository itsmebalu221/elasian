-- Migration: Ensure all external_registrations columns exist
-- This migration is idempotent and can be run multiple times safely
-- Created: 2026-01-22

-- Check and add esparto_events column
SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'external_registrations' 
    AND COLUMN_NAME = 'esparto_events'
);
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE external_registrations ADD COLUMN esparto_events JSON NULL COMMENT ''Selected Esparto events as JSON array''', 
    'SELECT ''Column esparto_events already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add esparto_mode column
SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'external_registrations' 
    AND COLUMN_NAME = 'esparto_mode'
);
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE external_registrations ADD COLUMN esparto_mode ENUM(''attendee'', ''participant'') NULL COMMENT ''Esparto participation mode''', 
    'SELECT ''Column esparto_mode already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add esparto_participant_type column
SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'external_registrations' 
    AND COLUMN_NAME = 'esparto_participant_type'
);
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE external_registrations ADD COLUMN esparto_participant_type ENUM(''solo'', ''group'') NULL COMMENT ''Esparto participant type (solo/group)''', 
    'SELECT ''Column esparto_participant_type already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add esparto_team_members column
SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'external_registrations' 
    AND COLUMN_NAME = 'esparto_team_members'
);
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE external_registrations ADD COLUMN esparto_team_members TEXT NULL COMMENT ''Esparto group team members details''', 
    'SELECT ''Column esparto_team_members already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add sahitya_events column
SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'external_registrations' 
    AND COLUMN_NAME = 'sahitya_events'
);
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE external_registrations ADD COLUMN sahitya_events TEXT NULL COMMENT ''Selected Sahitya events as JSON array''', 
    'SELECT ''Column sahitya_events already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add prasasti_events column
SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'external_registrations' 
    AND COLUMN_NAME = 'prasasti_events'
);
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE external_registrations ADD COLUMN prasasti_events JSON NULL COMMENT ''Selected Prasasti events as JSON array''', 
    'SELECT ''Column prasasti_events already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add prasasti_mode column
SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'external_registrations' 
    AND COLUMN_NAME = 'prasasti_mode'
);
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE external_registrations ADD COLUMN prasasti_mode ENUM(''attendee'', ''participant'') NULL COMMENT ''Prasasti participation mode''', 
    'SELECT ''Column prasasti_mode already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add prasasti_performance_type column (used for solo/group)
SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'external_registrations' 
    AND COLUMN_NAME = 'prasasti_performance_type'
);
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE external_registrations ADD COLUMN prasasti_performance_type ENUM(''solo'', ''group'') NULL COMMENT ''Prasasti performance type (solo/group)''', 
    'SELECT ''Column prasasti_performance_type already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add prasasti_team_members column
SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'external_registrations' 
    AND COLUMN_NAME = 'prasasti_team_members'
);
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE external_registrations ADD COLUMN prasasti_team_members TEXT NULL COMMENT ''Prasasti group team members details''', 
    'SELECT ''Column prasasti_team_members already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verify all columns exist
SELECT 
    'external_registrations columns check' AS verification,
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'external_registrations' 
     AND COLUMN_NAME IN ('esparto_events', 'esparto_mode', 'esparto_participant_type', 'esparto_team_members',
                         'sahitya_events', 'prasasti_events', 'prasasti_mode', 
                         'prasasti_performance_type', 'prasasti_team_members')) AS columns_found,
    9 AS expected_columns;
