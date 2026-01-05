-- Add user_type column to students table to distinguish between INTERNAL and EXTERNAL users
ALTER TABLE students 
ADD COLUMN user_type ENUM('INTERNAL', 'EXTERNAL') DEFAULT 'INTERNAL' AFTER email;

-- Update existing @hitam.org users to INTERNAL
UPDATE students 
SET user_type = 'INTERNAL' 
WHERE email LIKE '%@hitam.org';

-- Update other users to EXTERNAL
UPDATE students 
SET user_type = 'EXTERNAL' 
WHERE email NOT LIKE '%@hitam.org';

-- Add index for better query performance
CREATE INDEX idx_user_type ON students(user_type);
