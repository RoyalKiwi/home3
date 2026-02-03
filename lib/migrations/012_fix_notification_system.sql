-- Migration 012: Fix Notification System
-- Purpose: Fix driver capability mismatches, make metric_type nullable, add uptime metric
-- Date: 2026-02-03
-- CRITICAL: This migration fixes the fundamental bug preventing threshold notifications

BEGIN TRANSACTION;

-- =============================================================================
-- PART A: Fix Driver Capability Values (THE CRITICAL FIX)
-- =============================================================================
-- Problem: Database stores 'cpu_usage' but drivers return 'cpu'
-- Result: Metric lookup ALWAYS fails, notifications never trigger
-- Fix: Update driver_capability to match actual driver return values

-- Netdata driver capabilities (drivers/netdata.ts returns: cpu, memory, disk, network)
UPDATE metric_definitions SET driver_capability = 'cpu' WHERE metric_key = 'netdata_cpu_usage';
UPDATE metric_definitions SET driver_capability = 'memory' WHERE metric_key = 'netdata_memory_usage';
UPDATE metric_definitions SET driver_capability = 'disk' WHERE metric_key = 'netdata_disk_usage';
UPDATE metric_definitions SET driver_capability = 'network' WHERE metric_key = 'netdata_network_bandwidth';

-- Unraid driver capabilities (drivers/unraid.ts returns: cpu, memory, disk, docker, temperature)
UPDATE metric_definitions SET driver_capability = 'cpu' WHERE metric_key = 'unraid_cpu_cores';
UPDATE metric_definitions SET driver_capability = 'memory' WHERE metric_key = 'unraid_memory_usage';
UPDATE metric_definitions SET driver_capability = 'disk' WHERE metric_key = 'unraid_disk_usage';
UPDATE metric_definitions SET driver_capability = 'docker' WHERE metric_key = 'unraid_docker_containers';
UPDATE metric_definitions SET driver_capability = 'temperature' WHERE metric_key = 'unraid_drive_temperature';

-- Uptime Kuma driver capabilities (drivers/uptime-kuma.ts returns: uptime, services)
UPDATE metric_definitions SET driver_capability = 'services' WHERE metric_key = 'uptime_kuma_status';

-- Add missing Uptime Kuma 'uptime' metric for API monitor threshold alerts
INSERT INTO metric_definitions (
  metric_key,
  display_name,
  integration_type,
  driver_capability,
  category,
  condition_type,
  operators,
  unit,
  description,
  is_active
) VALUES (
  'uptime_kuma_uptime',
  'Service Uptime',
  'uptime-kuma',
  'uptime',
  'health',
  'threshold',
  '["gt", "lt", "gte", "lte", "eq"]',
  '%',
  'Overall uptime percentage from Uptime Kuma',
  1
);

-- =============================================================================
-- PART B: Make metric_type Nullable
-- =============================================================================
-- Problem: metric_type has NOT NULL constraint, blocks rule creation with metric_definition_id
-- Fix: Recreate table with nullable metric_type (SQLite doesn't support ALTER COLUMN)

-- 1. Drop dependent view (will be recreated later)
DROP VIEW IF EXISTS notification_history_view;

-- 2. Disable foreign key constraints during table recreation
PRAGMA foreign_keys = OFF;

-- 3. Create new table with nullable metric_type
CREATE TABLE notification_rules_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id INTEGER NOT NULL REFERENCES webhook_configs(id),
  name TEXT NOT NULL,
  metric_type TEXT NULL,  -- CHANGED: NULL instead of NOT NULL
  metric_definition_id INTEGER REFERENCES metric_definitions(id),
  condition_type TEXT NOT NULL CHECK(condition_type IN ('threshold', 'status_change', 'presence')),
  threshold_value REAL,
  threshold_operator TEXT CHECK(threshold_operator IN ('gt', 'lt', 'gte', 'lte', 'eq')),
  from_status TEXT,
  to_status TEXT,
  target_type TEXT CHECK(target_type IN ('all', 'card', 'integration')),
  target_id INTEGER,
  is_active BOOLEAN DEFAULT 1,
  cooldown_minutes INTEGER DEFAULT 30,
  severity TEXT CHECK(severity IN ('info', 'warning', 'critical')) DEFAULT 'warning',
  template_id INTEGER REFERENCES notification_templates(id),
  aggregation_enabled BOOLEAN DEFAULT 0,
  aggregation_window_ms INTEGER DEFAULT 60000,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 4. Copy all existing data from old table to new table
INSERT INTO notification_rules_new SELECT * FROM notification_rules;

-- 5. Drop old table
DROP TABLE notification_rules;

-- 6. Rename new table to original name
ALTER TABLE notification_rules_new RENAME TO notification_rules;

-- 7. Recreate indexes
CREATE INDEX IF NOT EXISTS idx_notification_rules_webhook ON notification_rules(webhook_id);
CREATE INDEX IF NOT EXISTS idx_notification_rules_target ON notification_rules(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_notification_rules_metric_def ON notification_rules(metric_definition_id);

-- 8. Recreate the dependent view (from migration 011)
CREATE VIEW IF NOT EXISTS notification_history_view AS
SELECT
  nh.*,
  nr.name as rule_name,
  wc.name as webhook_name
FROM notification_history nh
JOIN notification_rules nr ON nh.rule_id = nr.id
JOIN webhook_configs wc ON nh.webhook_id = wc.id;

-- 9. Re-enable foreign key constraints
PRAGMA foreign_keys = ON;

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES (Run after migration to verify success)
-- =============================================================================
-- Check driver_capability values are correct:
-- SELECT metric_key, driver_capability FROM metric_definitions WHERE integration_type IN ('netdata', 'unraid', 'uptime-kuma') ORDER BY integration_type, metric_key;
-- Expected: Short names like 'cpu', 'memory', 'temperature', NOT 'cpu_usage', 'memory_usage', 'drive_temperature'

-- Check metric_type is nullable:
-- PRAGMA table_info(notification_rules);
-- Expected: metric_type with notnull=0

-- Check uptime metric exists:
-- SELECT * FROM metric_definitions WHERE metric_key = 'uptime_kuma_uptime';
-- Expected: 1 row returned

-- Check notification_history_view recreated:
-- SELECT name FROM sqlite_master WHERE type='view' AND name='notification_history_view';
-- Expected: notification_history_view

-- =============================================================================
-- ROLLBACK INSTRUCTIONS
-- =============================================================================
-- If this migration fails, restore from backup:
-- docker exec homepage3 cp /app/data/database.db.backup /app/data/database.db
