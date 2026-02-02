// Database model types

export interface Category {
  id: number;
  name: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Subcategory {
  id: number;
  category_id: number;
  name: string;
  order_index: number;
  show_separator: boolean;
  admin_only: boolean;
  created_at: string;
  updated_at: string;
}

export type CardSize = 'small' | 'medium' | 'large';
export type GradientStyle = 'diagonal' | 'four-corner' | 'radial' | 'conic' | 'horizontal' | 'vertical' | 'double-diagonal';

export interface Card {
  id: number;
  subcategory_id: number;
  name: string;
  subtext: string;
  url: string;
  icon_url: string | null;
  gradient_colors: string | null;
  gradient_style: GradientStyle;
  size: CardSize;
  show_status: boolean;
  status_source_id: number | null;
  status_monitor_name: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

// Request payload types

export interface CreateCategoryRequest {
  name: string;
  order_index?: number;
}

export interface UpdateCategoryRequest {
  name?: string;
  order_index?: number;
}

export interface CreateSubcategoryRequest {
  category_id: number;
  name: string;
  order_index?: number;
  show_separator?: boolean;
  admin_only?: boolean;
}

export interface UpdateSubcategoryRequest {
  category_id?: number;
  name?: string;
  order_index?: number;
  show_separator?: boolean;
  admin_only?: boolean;
}

export interface CreateCardRequest {
  subcategory_id: number;
  name: string;
  subtext: string;
  url: string;
  icon_url?: string | null;
  gradient_colors?: string | null;
  gradient_style?: GradientStyle;
  size?: CardSize;
  show_status?: boolean;
  order_index?: number;
}

export interface UpdateCardRequest {
  subcategory_id?: number;
  name?: string;
  subtext?: string;
  url?: string;
  icon_url?: string | null;
  gradient_colors?: string | null;
  gradient_style?: GradientStyle;
  size?: CardSize;
  show_status?: boolean;
  order_index?: number;
}

// Integration types

export type IntegrationType = 'uptime-kuma' | 'netdata' | 'unraid';

export interface Integration {
  id: number;
  service_name: string;
  service_type: IntegrationType;
  credentials: string | null; // Encrypted JSON
  poll_interval: number; // milliseconds
  is_active: boolean;
  last_poll_at: string | null;
  last_status: string | null;
  created_at: string;
  updated_at: string;
}

// Integration credential types (before encryption)

export interface UptimeKumaCredentials {
  url: string;
  apiKey: string;
}

export interface NetdataCredentials {
  url: string;
  username?: string;
  password?: string;
}

export interface UnraidCredentials {
  url: string;
  apiKey?: string;
  username?: string;
  password?: string;
}

export type IntegrationCredentials =
  | UptimeKumaCredentials
  | NetdataCredentials
  | UnraidCredentials;

// Integration request payloads

export interface CreateIntegrationRequest {
  service_name: string;
  service_type: IntegrationType;
  credentials: IntegrationCredentials;
  poll_interval?: number;
  is_active?: boolean;
}

export interface UpdateIntegrationRequest {
  service_name?: string;
  credentials?: IntegrationCredentials;
  poll_interval?: number;
  is_active?: boolean;
}

// Integration test result

export interface IntegrationTestResult {
  success: boolean;
  message: string;
  data?: any;
}

// Metric capabilities

export type MetricCapability =
  | 'uptime'           // Service uptime status
  | 'cpu'              // CPU usage percentage
  | 'memory'           // Memory usage
  | 'disk'             // Disk usage
  | 'network'          // Network stats
  | 'temperature'      // System temperature
  | 'docker'           // Docker container stats
  | 'services';        // Service health monitoring

export interface MetricData {
  timestamp: string;
  value: number | string | boolean;
  unit?: string;
  metadata?: Record<string, any>;
}

// =============================================================================
// NOTIFICATION SYSTEM TYPES (Phase 7)
// =============================================================================

// Webhook provider types

export type WebhookProviderType = 'discord' | 'telegram' | 'pushover';

export interface WebhookConfig {
  id: number;
  name: string;
  provider_type: WebhookProviderType;
  webhook_url: string;              // Encrypted in DB
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Notification rule metric types

export type MetricType =
  // Server Status (status_change condition)
  | 'server_offline'                // Card status: online → offline
  | 'server_online'                 // Card status: offline → online (recovery)
  | 'server_warning'                // Card status: integration unreachable

  // System Metrics (threshold condition)
  | 'cpu_temperature'               // CPU temp threshold (°C)
  | 'cpu_usage'                     // CPU usage percentage (%)
  | 'memory_usage'                  // RAM usage percentage (%)
  | 'disk_usage'                    // Disk space percentage (%)
  | 'drive_temperature'             // HDD/SSD temperature (°C)
  | 'array_status'                  // Unraid array status (parity errors, etc.)
  | 'docker_container_status'       // Container stopped/started
  | 'ups_battery_level'             // UPS battery percentage (%)
  | 'network_bandwidth';            // Network usage threshold (Mbps)

// Notification rule condition types

export type ConditionType = 'threshold' | 'status_change' | 'presence';

export type ThresholdOperator = 'gt' | 'lt' | 'gte' | 'lte' | 'eq';

export type TargetType = 'all' | 'card' | 'integration';

export type Severity = 'info' | 'warning' | 'critical';

// Notification rule model

export interface NotificationRule {
  id: number;
  webhook_id: number;
  name: string;
  metric_type: MetricType;                   // Legacy field (deprecated, use metric_definition_id)
  metric_definition_id: number | null;       // FK to metric_definitions (Phase 1 expansion)
  condition_type: ConditionType;

  // Threshold configuration
  threshold_value: number | null;
  threshold_operator: ThresholdOperator | null;

  // Status change configuration
  from_status: string | null;
  to_status: string | null;

  // Targeting
  target_type: TargetType;
  target_id: number | null;

  // Behavior
  is_active: boolean;
  cooldown_minutes: number;
  severity: Severity;

  created_at: string;
  updated_at: string;
}

// Notification rule with webhook details (for UI)

export interface NotificationRuleWithWebhook extends NotificationRule {
  webhook_name: string;
  webhook_provider_type: WebhookProviderType;
}

// Request payloads

export interface CreateWebhookRequest {
  name: string;
  provider_type: WebhookProviderType;
  webhook_url: string;
  is_active?: boolean;
}

export interface UpdateWebhookRequest {
  name?: string;
  webhook_url?: string;
  is_active?: boolean;
}

export interface CreateNotificationRuleRequest {
  webhook_id: number;
  name: string;
  metric_type: MetricType;
  condition_type: ConditionType;

  // Threshold fields (required if condition_type = 'threshold')
  threshold_value?: number;
  threshold_operator?: ThresholdOperator;

  // Status change fields (required if condition_type = 'status_change')
  from_status?: string;
  to_status?: string;

  // Targeting
  target_type: TargetType;
  target_id?: number;

  // Behavior
  is_active?: boolean;
  cooldown_minutes?: number;
  severity?: Severity;
}

export interface UpdateNotificationRuleRequest {
  webhook_id?: number;
  name?: string;
  metric_type?: MetricType;
  condition_type?: ConditionType;
  threshold_value?: number | null;
  threshold_operator?: ThresholdOperator | null;
  from_status?: string | null;
  to_status?: string | null;
  target_type?: TargetType;
  target_id?: number | null;
  is_active?: boolean;
  cooldown_minutes?: number;
  severity?: Severity;
}

// Notification payload (sent to webhook)

export interface NotificationPayload {
  alertType: MetricType;
  title: string;
  message: string;
  severity: Severity;
  metadata?: {
    cardName?: string;
    cardId?: number;
    integrationId?: number;
    oldStatus?: string;
    newStatus?: string;
    metricValue?: number;
    threshold?: number;
    [key: string]: any;
  };
}

// Metric metadata (for UI dropdown)

export interface MetricMetadata {
  type: MetricType;
  displayName: string;
  category: 'status' | 'performance' | 'health';
  conditionType: ConditionType;
  operators?: ThresholdOperator[];
  unit?: string;
  description: string;
}

// =============================================================================
// DYNAMIC METRICS SYSTEM (Phase 1 Expansion)
// =============================================================================

/**
 * Metric definition from database
 * Replaces hardcoded MetricType with dynamic, integration-driven metrics
 */
export interface MetricDefinition {
  id: number;
  metric_key: string;                        // e.g., 'netdata_cpu_usage', 'unraid_disk_usage'
  display_name: string;                      // e.g., 'CPU Usage', 'Disk Usage'
  integration_type: string | null;           // e.g., 'netdata', 'unraid', NULL for generic
  driver_capability: string | null;          // Maps to driver capability (e.g., 'cpu_usage')
  category: 'system' | 'status' | 'health' | 'network'; // Metric category
  condition_type: ConditionType;             // 'threshold', 'status_change', 'presence'
  operators: string;                         // JSON array of operators: ["gt", "lt", "gte", "lte", "eq"]
  unit: string | null;                       // e.g., '%', '°C', 'MB', 'Mbps', NULL for status
  description: string | null;                // Helper text for admin UI
  is_active: boolean;                        // Whether metric is available
}

/**
 * Parsed metric definition with operators as array
 */
export interface ParsedMetricDefinition extends Omit<MetricDefinition, 'operators'> {
  operators: string[];                       // Parsed from JSON string
}
