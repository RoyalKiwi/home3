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
