-- Migration 011: Notification History Tracking
-- Purpose: Track sent notifications for audit and debugging
-- Date: 2026-02-03

-- Notification history table
CREATE TABLE IF NOT EXISTS notification_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id INTEGER NOT NULL,                  -- FK to notification_rules
  webhook_id INTEGER NOT NULL,               -- FK to webhook_configs
  alert_type TEXT,                           -- Metric type that triggered
  title TEXT NOT NULL,                       -- Notification title
  message TEXT NOT NULL,                     -- Notification message
  severity TEXT NOT NULL CHECK(severity IN ('info', 'warning', 'critical')),
  provider_type TEXT NOT NULL CHECK(provider_type IN ('discord', 'telegram', 'pushover')),

  -- Delivery status
  status TEXT NOT NULL CHECK(status IN ('sent', 'failed', 'retrying')) DEFAULT 'sent',
  attempts INTEGER DEFAULT 1,                -- Number of delivery attempts
  error_message TEXT,                        -- Error details if failed

  -- Metadata
  metadata TEXT,                             -- JSON blob of additional data

  -- Timestamps
  sent_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (rule_id) REFERENCES notification_rules(id) ON DELETE CASCADE,
  FOREIGN KEY (webhook_id) REFERENCES webhook_configs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_history_rule ON notification_history(rule_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_webhook ON notification_history(webhook_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_status ON notification_history(status);
CREATE INDEX IF NOT EXISTS idx_notification_history_sent_at ON notification_history(sent_at);
CREATE INDEX IF NOT EXISTS idx_notification_history_severity ON notification_history(severity);

-- View for notification history with joined details
CREATE VIEW IF NOT EXISTS notification_history_view AS
SELECT
  nh.*,
  nr.name as rule_name,
  wc.name as webhook_name
FROM notification_history nh
JOIN notification_rules nr ON nh.rule_id = nr.id
JOIN webhook_configs wc ON nh.webhook_id = wc.id;

-- =============================================================================
-- ROLLBACK INSTRUCTIONS
-- =============================================================================
-- To rollback this migration:
-- DROP VIEW IF EXISTS notification_history_view;
-- DROP TABLE IF EXISTS notification_history;
