-- Migration 006: Notification Webhooks and Rules System
-- Purpose: Add configurable notification engine with webhook-based alerts
-- Date: 2026-02-02

-- =============================================================================
-- 1. WEBHOOK CONFIGURATIONS TABLE
-- Purpose: Store webhook destinations (Discord, Telegram, Pushover)
-- =============================================================================

CREATE TABLE IF NOT EXISTS webhook_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                    -- User-friendly name (e.g., "Discord - Ops Team")
  provider_type TEXT NOT NULL CHECK(provider_type IN ('discord', 'telegram', 'pushover')),
  webhook_url TEXT NOT NULL,             -- Encrypted URL/token
  is_active BOOLEAN DEFAULT 1,           -- Enable/disable webhook
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_webhook_configs_active
  ON webhook_configs(is_active);

-- =============================================================================
-- 2. NOTIFICATION RULES TABLE
-- Purpose: Define what to notify about (rules-based alerts)
-- =============================================================================

CREATE TABLE IF NOT EXISTS notification_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id INTEGER NOT NULL,           -- FK to webhook_configs
  name TEXT NOT NULL,                    -- User-friendly name (e.g., "CPU Temp Alert")
  metric_type TEXT NOT NULL,             -- server_offline, cpu_temperature, etc.
  condition_type TEXT NOT NULL CHECK(condition_type IN ('threshold', 'status_change', 'presence')),

  -- Threshold configuration (for numeric metrics like CPU > 80)
  threshold_value REAL,                  -- e.g., 80 for "CPU > 80°C"
  threshold_operator TEXT CHECK(threshold_operator IN ('gt', 'lt', 'gte', 'lte', 'eq')),

  -- Status change configuration (for state transitions)
  from_status TEXT,                      -- e.g., "online" for offline alerts
  to_status TEXT,                        -- e.g., "offline"

  -- Targeting (which cards/integrations to monitor)
  target_type TEXT CHECK(target_type IN ('all', 'card', 'integration')),
  target_id INTEGER,                     -- card_id or integration_id (NULL if target_type = 'all')

  -- Behavior configuration
  is_active BOOLEAN DEFAULT 1,           -- Enable/disable rule
  cooldown_minutes INTEGER DEFAULT 30,   -- Time between repeat notifications
  severity TEXT CHECK(severity IN ('info', 'warning', 'critical')) DEFAULT 'warning',

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (webhook_id) REFERENCES webhook_configs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_rules_active
  ON notification_rules(is_active);

CREATE INDEX IF NOT EXISTS idx_notification_rules_webhook
  ON notification_rules(webhook_id);

CREATE INDEX IF NOT EXISTS idx_notification_rules_metric
  ON notification_rules(metric_type);

CREATE INDEX IF NOT EXISTS idx_notification_rules_target
  ON notification_rules(target_type, target_id);

-- =============================================================================
-- 3. FLOOD CONTROL STATE STORAGE
-- Purpose: Track last notification time per rule to prevent spam
-- =============================================================================

INSERT OR IGNORE INTO settings (key, value)
  VALUES ('notification_flood_state', '{}');

-- =============================================================================
-- EXAMPLES OF NOTIFICATION RULES
-- =============================================================================

-- Example 1: Server Offline Alert
-- INSERT INTO notification_rules (webhook_id, name, metric_type, condition_type, from_status, to_status, target_type, severity)
-- VALUES (1, 'Server Offline Alert', 'server_offline', 'status_change', 'online', 'offline', 'all', 'critical');

-- Example 2: CPU Temperature Threshold
-- INSERT INTO notification_rules (webhook_id, name, metric_type, condition_type, threshold_operator, threshold_value, target_type, target_id, severity)
-- VALUES (1, 'CPU Temp High', 'cpu_temperature', 'threshold', 'gt', 80, 'integration', 1, 'warning');

-- Example 3: Disk Usage Warning
-- INSERT INTO notification_rules (webhook_id, name, metric_type, condition_type, threshold_operator, threshold_value, target_type, severity, cooldown_minutes)
-- VALUES (1, 'Disk Space Low', 'disk_usage', 'threshold', 'gt', 90, 'all', 'warning', 60);

-- =============================================================================
-- ROLLBACK INSTRUCTIONS
-- =============================================================================
-- To rollback this migration:
-- DROP TABLE IF EXISTS notification_rules;
-- DROP TABLE IF EXISTS webhook_configs;
-- DELETE FROM settings WHERE key = 'notification_flood_state';
