-- Migration: Add cultural event columns to external_registrations table
-- Run this SQL to add Sahitya and Prasasti event selection support

ALTER TABLE external_registrations
ADD COLUMN sahitya_events TEXT NULL COMMENT 'Selected Sahitya (Day 1) events as JSON array',
ADD COLUMN prasasti_event VARCHAR(50) NULL COMMENT 'Selected Prasasti (Day 2) event',
ADD COLUMN prasasti_performance_type ENUM('solo', 'group') NULL COMMENT 'Performance type for Prasasti events',
ADD COLUMN prasasti_performance_fee INT DEFAULT 0 COMMENT 'Performance fee (50 for solo, 350 for group)';
