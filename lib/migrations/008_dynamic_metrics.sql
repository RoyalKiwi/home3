-- Migration 008: Dynamic Metrics System
-- Replaces hardcoded MetricType with database-driven metric definitions

-- Metric definitions table (single source of truth for available metrics)
CREATE TABLE IF NOT EXISTS metric_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_key TEXT NOT NULL UNIQUE, -- e.g., 'cpu_usage', 'disk_usage'
  display_name TEXT NOT NULL, -- e.g., 'CPU Usage', 'Disk Usage'
  integration_type TEXT, -- e.g., 'netdata', 'unraid', 'uptime-kuma', NULL for generic
  driver_capability TEXT, -- Maps to driver capability name (e.g., 'cpu_usage')
  category TEXT NOT NULL, -- 'system', 'status', 'health', 'network'
  condition_type TEXT NOT NULL CHECK(condition_type IN ('threshold', 'status_change', 'presence')),
  operators TEXT, -- JSON array of supported operators: ["gt", "lt", "gte", "lte", "eq"]
  unit TEXT, -- e.g., '%', '°C', 'MB', 'Mbps', NULL for status changes
  description TEXT, -- Helper text for admin UI
  is_active BOOLEAN DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_metric_definitions_key ON metric_definitions(metric_key);
CREATE INDEX IF NOT EXISTS idx_metric_definitions_integration ON metric_definitions(integration_type);
CREATE INDEX IF NOT EXISTS idx_metric_definitions_active ON metric_definitions(is_active);

-- Add metric_definition_id FK to notification_rules (keep metric_type for backward compatibility)
ALTER TABLE notification_rules ADD COLUMN metric_definition_id INTEGER REFERENCES metric_definitions(id);
CREATE INDEX IF NOT EXISTS idx_notification_rules_metric_def ON notification_rules(metric_definition_id);

-- Seed initial metrics from existing drivers and hardcoded types

-- Status metrics (generic, no integration)
INSERT INTO metric_definitions (metric_key, display_name, integration_type, category, condition_type, operators, unit, description) VALUES
  ('server_offline', 'Server Offline', NULL, 'status', 'status_change', '["eq"]', NULL, 'Alert when a card goes offline'),
  ('server_online', 'Server Online (Recovery)', NULL, 'status', 'status_change', '["eq"]', NULL, 'Alert when a card comes back online'),
  ('server_warning', 'Server Warning', NULL, 'status', 'status_change', '["eq"]', NULL, 'Alert when a card status becomes warning');

-- Netdata metrics
INSERT INTO metric_definitions (metric_key, display_name, integration_type, driver_capability, category, condition_type, operators, unit, description) VALUES
  ('netdata_cpu_usage', 'CPU Usage', 'netdata', 'cpu_usage', 'system', 'threshold', '["gt", "lt", "gte", "lte", "eq"]', '%', 'CPU usage percentage from Netdata'),
  ('netdata_memory_usage', 'Memory Usage', 'netdata', 'memory_usage', 'system', 'threshold', '["gt", "lt", "gte", "lte", "eq"]', '%', 'RAM usage percentage from Netdata'),
  ('netdata_disk_usage', 'Disk Usage', 'netdata', 'disk_usage', 'system', 'threshold', '["gt", "lt", "gte", "lte", "eq"]', '%', 'Disk space usage from Netdata'),
  ('netdata_network_bandwidth', 'Network Bandwidth', 'netdata', 'network_bandwidth', 'network', 'threshold', '["gt", "lt", "gte", "lte", "eq"]', 'Mbps', 'Network usage from Netdata');

-- Unraid metrics
INSERT INTO metric_definitions (metric_key, display_name, integration_type, driver_capability, category, condition_type, operators, unit, description) VALUES
  ('unraid_cpu_cores', 'CPU Core Count', 'unraid', 'cpu_cores', 'system', 'threshold', '["gt", "lt", "gte", "lte", "eq"]', NULL, 'Number of CPU cores from Unraid'),
  ('unraid_memory_usage', 'Memory Usage', 'unraid', 'memory_usage', 'system', 'threshold', '["gt", "lt", "gte", "lte", "eq"]', '%', 'RAM usage from Unraid'),
  ('unraid_disk_usage', 'Disk Usage', 'unraid', 'disk_usage', 'system', 'threshold', '["gt", "lt", "gte", "lte", "eq"]', '%', 'Array disk usage from Unraid'),
  ('unraid_docker_containers', 'Docker Container Count', 'unraid', 'docker_containers', 'system', 'threshold', '["gt", "lt", "gte", "lte", "eq"]', NULL, 'Number of running containers'),
  ('unraid_drive_temperature', 'Drive Temperature', 'unraid', 'drive_temperature', 'health', 'threshold', '["gt", "lt", "gte", "lte", "eq"]', '°C', 'HDD/SSD temperature from Unraid');

-- Uptime Kuma metrics
INSERT INTO metric_definitions (metric_key, display_name, integration_type, driver_capability, category, condition_type, operators, unit, description) VALUES
  ('uptime_kuma_status', 'Service Status', 'uptime-kuma', 'service_status', 'status', 'status_change', '["eq"]', NULL, 'Service up/down status from Uptime Kuma');

-- Legacy metrics (for backward compatibility with existing rules)
INSERT INTO metric_definitions (metric_key, display_name, integration_type, category, condition_type, operators, unit, description) VALUES
  ('cpu_temperature', 'CPU Temperature (Legacy)', NULL, 'health', 'threshold', '["gt", "lt", "gte", "lte", "eq"]', '°C', 'Generic CPU temperature threshold'),
  ('array_status', 'Array Status (Legacy)', NULL, 'status', 'status_change', '["eq"]', NULL, 'Generic array status change'),
  ('docker_container_status', 'Docker Container Status (Legacy)', NULL, 'status', 'status_change', '["eq"]', NULL, 'Generic container status change'),
  ('ups_battery_level', 'UPS Battery Level (Legacy)', NULL, 'health', 'threshold', '["gt", "lt", "gte", "lte", "eq"]', '%', 'Generic UPS battery percentage');

-- Migrate existing rules to use metric_definition_id
UPDATE notification_rules
SET metric_definition_id = (
  SELECT id FROM metric_definitions
  WHERE metric_definitions.metric_key = notification_rules.metric_type
  LIMIT 1
)
WHERE metric_definition_id IS NULL
  AND metric_type IN (SELECT metric_key FROM metric_definitions);
