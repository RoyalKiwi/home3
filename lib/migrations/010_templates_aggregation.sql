-- Migration 010: Notification Templates and Aggregation Settings
-- Phase 4B: Adds customizable notification templates
-- Phase 4A: Adds aggregation configuration settings

-- Notification templates table
CREATE TABLE IF NOT EXISTS notification_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,                  -- Template name (e.g., "CPU Alert Template")
  title_template TEXT NOT NULL,               -- Title with variables: "🚨 {{severity}} Alert: {{metricName}}"
  message_template TEXT NOT NULL,             -- Message with variables
  is_default BOOLEAN DEFAULT 0,               -- Whether this is the system default template
  is_active BOOLEAN DEFAULT 1,                -- Whether template is available for use
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_active ON notification_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_notification_templates_default ON notification_templates(is_default);

-- Add template_id to notification_rules (optional, NULL uses default)
ALTER TABLE notification_rules ADD COLUMN template_id INTEGER REFERENCES notification_templates(id);
CREATE INDEX IF NOT EXISTS idx_notification_rules_template ON notification_rules(template_id);

-- Add aggregation settings to notification_rules (per-rule)
ALTER TABLE notification_rules ADD COLUMN aggregation_enabled BOOLEAN DEFAULT 0;
ALTER TABLE notification_rules ADD COLUMN aggregation_window_ms INTEGER DEFAULT 60000; -- Default: 60 seconds

-- Global aggregation settings
INSERT OR IGNORE INTO settings (key, value) VALUES ('aggregation_enabled', 'true');
INSERT OR IGNORE INTO settings (key, value) VALUES ('aggregation_window_ms', '60000');

-- Seed default notification templates

-- Template 1: Default System Template
INSERT INTO notification_templates (name, title_template, message_template, is_default, is_active) VALUES (
  'Default System Template',
  '{{severity}} Alert: {{metricName}}',
  '{{integrationName}} - {{metricDisplayName}} is {{metricValue}}{{unit}} (threshold: {{threshold}}{{unit}})',
  1,
  1
);

-- Template 2: Detailed Alert Template
INSERT INTO notification_templates (name, title_template, message_template, is_default, is_active) VALUES (
  'Detailed Alert',
  '🚨 {{severity}} Alert: {{metricName}}',
  'Alert triggered for {{cardName}}

**Metric**: {{metricDisplayName}}
**Current Value**: {{metricValue}}{{unit}}
**Threshold**: {{threshold}}{{unit}}
**Source**: {{integrationName}}
**Time**: {{timestamp}}

Please investigate immediately.',
  0,
  1
);

-- Template 3: Minimal Alert Template
INSERT INTO notification_templates (name, title_template, message_template, is_default, is_active) VALUES (
  'Minimal Alert',
  '{{metricName}}',
  '{{metricValue}}{{unit}} ({{threshold}}{{unit}})',
  0,
  1
);

-- Template 4: Status Change Template
INSERT INTO notification_templates (name, title_template, message_template, is_default, is_active) VALUES (
  'Status Change Alert',
  '{{cardName}} Status Changed',
  '{{cardName}} status changed from {{oldStatus}} to {{newStatus}}

**Time**: {{timestamp}}',
  0,
  1
);

-- Template 5: Critical Alert Template (with emojis)
INSERT INTO notification_templates (name, title_template, message_template, is_default, is_active) VALUES (
  'Critical Alert (Emoji)',
  '🔴 CRITICAL: {{metricName}}',
  '⚠️ **CRITICAL ALERT** ⚠️

**System**: {{cardName}}
**Issue**: {{metricDisplayName}} at {{metricValue}}{{unit}}
**Threshold**: {{threshold}}{{unit}}
**Severity**: {{severity}}

🚨 Immediate action required!',
  0,
  1
);

/**
 * Available template variables:
 *
 * General:
 * - {{timestamp}}        - ISO timestamp of alert
 * - {{severity}}         - Alert severity (info, warning, critical)
 * - {{metricName}}       - Short metric name (e.g., "cpu_usage")
 * - {{metricDisplayName}} - Human-readable metric name (e.g., "CPU Usage")
 *
 * Values:
 * - {{metricValue}}      - Current metric value
 * - {{threshold}}        - Threshold value
 * - {{unit}}             - Unit (%, °C, Mbps, etc.)
 *
 * Source:
 * - {{integrationName}}  - Integration name (e.g., "Netdata")
 * - {{integrationId}}    - Integration ID
 * - {{cardName}}         - Card name
 * - {{cardId}}           - Card ID
 *
 * Status Change:
 * - {{oldStatus}}        - Previous status
 * - {{newStatus}}        - New status
 */
