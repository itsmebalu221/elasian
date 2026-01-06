-- Add user_type column with HITAMONLY tag, create if missing
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS user_type ENUM('INTERNAL', 'HITAMONLY', 'EXTERNAL') DEFAULT 'INTERNAL' AFTER email;

-- Ensure HITAMONLY value is permitted before data migration
ALTER TABLE students 
MODIFY COLUMN user_type ENUM('INTERNAL', 'HITAMONLY', 'EXTERNAL') DEFAULT 'INTERNAL';

-- Update existing @hitam.org users to HITAMONLY
UPDATE students 
SET user_type = 'HITAMONLY' 
WHERE email LIKE '%@hitam.org';

-- Update other users to EXTERNAL
UPDATE students 
SET user_type = 'EXTERNAL' 
WHERE email NOT LIKE '%@hitam.org';

-- Finalize enum to drop legacy INTERNAL value once data migrated
ALTER TABLE students 
MODIFY COLUMN user_type ENUM('HITAMONLY', 'EXTERNAL') DEFAULT 'HITAMONLY';

-- Add index for better query performance
CREATE INDEX idx_user_type ON students(user_type);
