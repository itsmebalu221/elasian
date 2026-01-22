-- Migration: Add detailed event columns to external_registrations table
-- Run this SQL to support new Esparto and Prasasti registration fields

ALTER TABLE external_registrations
ADD COLUMN esparto_events JSON NULL COMMENT 'Selected Esparto events as JSON array',
ADD COLUMN prasasti_events JSON NULL COMMENT 'Selected Prasasti events as JSON array',
ADD COLUMN prasasti_mode ENUM('attendee', 'participant') NULL COMMENT 'Prasasti participation mode',
ADD COLUMN prasasti_team_members TEXT NULL COMMENT 'Prasasti group team members details',
ADD COLUMN sahitya_mode ENUM('attendee', 'participant') NULL COMMENT 'Legacy: Sahitya mode (for backward compatibility)',
ADD COLUMN sahitya_team_members TEXT NULL COMMENT 'Legacy: Sahitya team members';
