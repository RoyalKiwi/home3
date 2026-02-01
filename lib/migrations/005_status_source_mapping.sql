-- =============================================================================
-- HOMEPAGE3 DATABASE SCHEMA
-- Migration: 005_status_source_mapping
-- Description: Add status source configuration to cards and settings
-- =============================================================================

-- Add columns to cards for per-card monitor binding
-- status_source_id: which integration provides this card's status (NULL = use global default)
-- status_monitor_name: the exact monitor/container name from the source (NULL = unlinked)
ALTER TABLE cards ADD COLUMN status_source_id INTEGER DEFAULT NULL
  REFERENCES integrations(id) ON DELETE SET NULL;

ALTER TABLE cards ADD COLUMN status_monitor_name TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_cards_status_source ON cards(status_source_id);

-- Insert the global status source setting (NULL value = no source configured)
INSERT OR IGNORE INTO settings (key, value) VALUES ('status_source_id', NULL);

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
