-- Migration: Add event selection columns to student_forms table
-- Run this SQL to update your database schema for event registration

-- Add event selection columns for Day 1
ALTER TABLE student_forms 
ADD COLUMN day1_slot1 VARCHAR(20) NULL COMMENT 'Day 1, Slot 1 (10:00 AM - 12:00 PM) event selection',
ADD COLUMN day1_slot2 VARCHAR(20) NULL COMMENT 'Day 1, Slot 2 (1:00 PM - 3:00 PM) event selection',
ADD COLUMN day1_slot3 VARCHAR(20) NULL COMMENT 'Day 1, Slot 3 (3:00 PM - 5:00 PM) event selection';

-- Add event selection columns for Day 2
ALTER TABLE student_forms 
ADD COLUMN day2_slot1 VARCHAR(20) NULL COMMENT 'Day 2, Slot 1 (10:00 AM - 12:00 PM) event selection',
ADD COLUMN day2_slot2 VARCHAR(20) NULL COMMENT 'Day 2, Slot 2 (1:00 PM - 3:00 PM) event selection',
ADD COLUMN day2_slot3 VARCHAR(20) NULL COMMENT 'Day 2, Slot 3 (3:00 PM - 5:00 PM) event selection';

-- Optional: Create an events reference table for better data integrity
CREATE TABLE IF NOT EXISTS events (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    day ENUM('day1', 'day2') NOT NULL,
    slot ENUM('slot1', 'slot2', 'slot3') NOT NULL,
    venue VARCHAR(255),
    description TEXT,
    max_capacity INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert Day 1 events
INSERT INTO events (id, name, day, slot, venue, description) VALUES
-- Day 1, Slot 1 (10:00 AM - 12:00 PM)
('D1S1E1', 'Technical Quiz', 'day1', 'slot1', 'Seminar Hall A', 'Test your technical knowledge'),
('D1S1E2', 'Coding Challenge', 'day1', 'slot1', 'Computer Lab 1', 'Competitive programming contest'),
('D1S1E3', 'Paper Presentation', 'day1', 'slot1', 'Conference Room', 'Present your research papers'),
('D1S1E4', 'Poster Exhibition', 'day1', 'slot1', 'Main Lobby', 'Display your creative posters'),

-- Day 1, Slot 2 (1:00 PM - 3:00 PM)
('D1S2E1', 'Hackathon Round 1', 'day1', 'slot2', 'Computer Lab 1 & 2', 'Build innovative solutions'),
('D1S2E2', 'Web Development', 'day1', 'slot2', 'Computer Lab 3', 'Create stunning websites'),
('D1S2E3', 'Debugging Contest', 'day1', 'slot2', 'Computer Lab 4', 'Find and fix bugs'),
('D1S2E4', 'Tech Talk', 'day1', 'slot2', 'Auditorium', 'Listen to industry experts'),

-- Day 1, Slot 3 (3:00 PM - 5:00 PM)
('D1S3E1', 'Gaming Tournament', 'day1', 'slot3', 'Gaming Arena', 'Compete in esports'),
('D1S3E2', 'UI/UX Design', 'day1', 'slot3', 'Design Lab', 'Design user interfaces'),
('D1S3E3', 'Database Challenge', 'day1', 'slot3', 'Computer Lab 2', 'SQL and NoSQL challenges'),
('D1S3E4', 'Networking Workshop', 'day1', 'slot3', 'Network Lab', 'Learn networking concepts'),

-- Day 2, Slot 1 (10:00 AM - 12:00 PM)
('D2S1E1', 'AI/ML Workshop', 'day2', 'slot1', 'AI Lab', 'Hands-on machine learning'),
('D2S1E2', 'Mobile App Dev', 'day2', 'slot1', 'Computer Lab 1', 'Build mobile applications'),
('D2S1E3', 'Cybersecurity CTF', 'day2', 'slot1', 'Security Lab', 'Capture the flag challenge'),
('D2S1E4', 'Group Discussion', 'day2', 'slot1', 'Seminar Hall B', 'Discuss trending topics'),

-- Day 2, Slot 2 (1:00 PM - 3:00 PM)
('D2S2E1', 'Hackathon Final', 'day2', 'slot2', 'Computer Lab 1 & 2', 'Final hackathon round'),
('D2S2E2', 'Cloud Computing', 'day2', 'slot2', 'Cloud Lab', 'Deploy on cloud platforms'),
('D2S2E3', 'IoT Workshop', 'day2', 'slot2', 'IoT Lab', 'Internet of Things hands-on'),
('D2S2E4', 'Tech Debate', 'day2', 'slot2', 'Auditorium', 'Debate on tech topics'),

-- Day 2, Slot 3 (3:00 PM - 5:00 PM)
('D2S3E1', 'Project Showcase', 'day2', 'slot3', 'Main Hall', 'Display your projects'),
('D2S3E2', 'Blockchain Basics', 'day2', 'slot3', 'Computer Lab 3', 'Learn blockchain technology'),
('D2S3E3', 'DevOps Workshop', 'day2', 'slot3', 'DevOps Lab', 'CI/CD and automation'),
('D2S3E4', 'Prize Distribution', 'day2', 'slot3', 'Auditorium', 'Award ceremony');

-- Optional: Add foreign key constraints (uncomment if needed)
-- ALTER TABLE student_forms
-- ADD CONSTRAINT fk_day1_slot1 FOREIGN KEY (day1_slot1) REFERENCES events(id) ON DELETE SET NULL,
-- ADD CONSTRAINT fk_day1_slot2 FOREIGN KEY (day1_slot2) REFERENCES events(id) ON DELETE SET NULL,
-- ADD CONSTRAINT fk_day1_slot3 FOREIGN KEY (day1_slot3) REFERENCES events(id) ON DELETE SET NULL,
-- ADD CONSTRAINT fk_day2_slot1 FOREIGN KEY (day2_slot1) REFERENCES events(id) ON DELETE SET NULL,
-- ADD CONSTRAINT fk_day2_slot2 FOREIGN KEY (day2_slot2) REFERENCES events(id) ON DELETE SET NULL,
-- ADD CONSTRAINT fk_day2_slot3 FOREIGN KEY (day2_slot3) REFERENCES events(id) ON DELETE SET NULL;

-- View to get event registration counts
CREATE OR REPLACE VIEW event_registration_counts AS
SELECT 
    e.id AS event_id,
    e.name AS event_name,
    e.day,
    e.slot,
    e.venue,
    COALESCE(
        CASE 
            WHEN e.day = 'day1' AND e.slot = 'slot1' THEN (SELECT COUNT(*) FROM student_forms WHERE day1_slot1 = e.id)
            WHEN e.day = 'day1' AND e.slot = 'slot2' THEN (SELECT COUNT(*) FROM student_forms WHERE day1_slot2 = e.id)
            WHEN e.day = 'day1' AND e.slot = 'slot3' THEN (SELECT COUNT(*) FROM student_forms WHERE day1_slot3 = e.id)
            WHEN e.day = 'day2' AND e.slot = 'slot1' THEN (SELECT COUNT(*) FROM student_forms WHERE day2_slot1 = e.id)
            WHEN e.day = 'day2' AND e.slot = 'slot2' THEN (SELECT COUNT(*) FROM student_forms WHERE day2_slot2 = e.id)
            WHEN e.day = 'day2' AND e.slot = 'slot3' THEN (SELECT COUNT(*) FROM student_forms WHERE day2_slot3 = e.id)
        END, 0
    ) AS registration_count
FROM events e
ORDER BY e.day, e.slot, e.id;
