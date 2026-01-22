-- Adds Sahitya selection fields for HITAM student registrations
ALTER TABLE student_forms
  ADD COLUMN IF NOT EXISTS sahitya_selected BOOLEAN DEFAULT FALSE AFTER selected_events,
  ADD COLUMN IF NOT EXISTS sahitya_participant_type ENUM('solo','group') NULL AFTER sahitya_selected,
  ADD COLUMN IF NOT EXISTS sahitya_team_members JSON NULL AFTER sahitya_participant_type,
  ADD COLUMN IF NOT EXISTS sahitya_events JSON NULL AFTER sahitya_team_members;
