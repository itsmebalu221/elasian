-- Migration: Add Esparto participation mode columns to external_registrations table
-- Run this SQL to support new Esparto mode and team member fields

ALTER TABLE external_registrations
ADD COLUMN esparto_mode ENUM('attendee', 'participant') NULL COMMENT 'Esparto participation mode',
ADD COLUMN esparto_participant_type ENUM('solo', 'group') NULL COMMENT 'Esparto participant type',
ADD COLUMN esparto_team_members TEXT NULL COMMENT 'Esparto group team members details';
