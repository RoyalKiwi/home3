-- Migration 009: Unraid Webhook Receiver System
-- Adds metrics for Unraid internal notification events
-- Creates audit table for incoming webhook events

-- Add Unraid webhook event metrics to metric_definitions
INSERT INTO metric_definitions (metric_key, display_name, integration_type, driver_capability, category, condition_type, operators, unit, description, is_active) VALUES
  -- Array events
  ('unraid_array_started', 'Array Started', 'unraid-webhook', 'array_started', 'status', 'presence', '["eq"]', NULL, 'Unraid array has been started', 1),
  ('unraid_array_stopped', 'Array Stopped', 'unraid-webhook', 'array_stopped', 'status', 'presence', '["eq"]', NULL, 'Unraid array has been stopped', 1),
  ('unraid_array_offline', 'Array Offline', 'unraid-webhook', 'array_offline', 'status', 'presence', '["eq"]', NULL, 'Unraid array went offline unexpectedly', 1),

  -- Parity events
  ('unraid_parity_check_started', 'Parity Check Started', 'unraid-webhook', 'parity_check_started', 'status', 'presence', '["eq"]', NULL, 'Parity check has started', 1),
  ('unraid_parity_check_finished', 'Parity Check Finished', 'unraid-webhook', 'parity_check_finished', 'status', 'presence', '["eq"]', NULL, 'Parity check has completed', 1),
  ('unraid_parity_errors', 'Parity Errors Detected', 'unraid-webhook', 'parity_errors', 'health', 'presence', '["eq"]', NULL, 'Parity errors were found during check', 1),

  -- Docker events
  ('unraid_docker_started', 'Docker Container Started', 'unraid-webhook', 'docker_started', 'status', 'presence', '["eq"]', NULL, 'Docker container was started', 1),
  ('unraid_docker_stopped', 'Docker Container Stopped', 'unraid-webhook', 'docker_stopped', 'status', 'presence', '["eq"]', NULL, 'Docker container was stopped', 1),

  -- Health events
  ('unraid_drive_temperature_high', 'Drive Temperature High', 'unraid-webhook', 'drive_temp_high', 'health', 'presence', '["eq"]', NULL, 'Drive temperature exceeded safe threshold', 1),
  ('unraid_ups_battery_low', 'UPS Battery Low', 'unraid-webhook', 'ups_battery_low', 'health', 'presence', '["eq"]', NULL, 'UPS battery level is critically low', 1),
  ('unraid_disk_full', 'Disk Full', 'unraid-webhook', 'disk_full', 'health', 'presence', '["eq"]', NULL, 'Disk space is critically low or full', 1),

  -- System events
  ('unraid_server_reboot', 'Server Reboot', 'unraid-webhook', 'server_reboot', 'status', 'presence', '["eq"]', NULL, 'Unraid server is rebooting', 1),
  ('unraid_server_shutdown', 'Server Shutdown', 'unraid-webhook', 'server_shutdown', 'status', 'presence', '["eq"]', NULL, 'Unraid server is shutting down', 1);

-- Audit table for incoming Unraid webhook events
CREATE TABLE IF NOT EXISTS unraid_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,              -- Event identifier (e.g., 'array.started', 'parity.errors')
  subject TEXT,                          -- Event subject/title from Unraid
  description TEXT,                      -- Event description from Unraid
  importance TEXT,                       -- normal, warning, alert
  event_data TEXT,                       -- JSON blob of additional event data
  received_at TEXT DEFAULT (datetime('now')),
  processed BOOLEAN DEFAULT 0,           -- Whether notification rules were evaluated
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_unraid_events_type ON unraid_events(event_type);
CREATE INDEX IF NOT EXISTS idx_unraid_events_received ON unraid_events(received_at);
CREATE INDEX IF NOT EXISTS idx_unraid_events_processed ON unraid_events(processed);

-- Store Unraid webhook API key in settings
INSERT OR IGNORE INTO settings (key, value)
  VALUES ('unraid_webhook_api_key', NULL);

-- Store webhook receiver enabled/disabled state
INSERT OR IGNORE INTO settings (key, value)
  VALUES ('unraid_webhook_enabled', 'false');
