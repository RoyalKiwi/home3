/**
 * Metric Registry Service
 *
 * Manages dynamic metric definitions and auto-registers driver capabilities.
 * Replaces hardcoded MetricType with database-driven system.
 */

import { getDb } from '@/lib/db';
import type { MetricDefinition } from '@/lib/types';

/**
 * Driver capability metadata for auto-registration
 */
interface DriverCapabilityMetadata {
  capability: string;
  displayName: string;
  category: 'system' | 'status' | 'health' | 'network';
  conditionType: 'threshold' | 'status_change' | 'presence';
  operators: string[];
  unit?: string;
  description: string;
}

/**
 * Driver integration metadata
 */
interface DriverMetadata {
  integrationType: string;
  capabilities: DriverCapabilityMetadata[];
}

/**
 * Registry of driver capabilities
 * Each driver should register its capabilities here
 */
const DRIVER_REGISTRY: Record<string, DriverMetadata> = {
  netdata: {
    integrationType: 'netdata',
    capabilities: [
      {
        capability: 'cpu_usage',
        displayName: 'CPU Usage',
        category: 'system',
        conditionType: 'threshold',
        operators: ['gt', 'lt', 'gte', 'lte', 'eq'],
        unit: '%',
        description: 'CPU usage percentage from Netdata'
      },
      {
        capability: 'memory_usage',
        displayName: 'Memory Usage',
        category: 'system',
        conditionType: 'threshold',
        operators: ['gt', 'lt', 'gte', 'lte', 'eq'],
        unit: '%',
        description: 'RAM usage percentage from Netdata'
      },
      {
        capability: 'disk_usage',
        displayName: 'Disk Usage',
        category: 'system',
        conditionType: 'threshold',
        operators: ['gt', 'lt', 'gte', 'lte', 'eq'],
        unit: '%',
        description: 'Disk space usage from Netdata'
      },
      {
        capability: 'network_bandwidth',
        displayName: 'Network Bandwidth',
        category: 'network',
        conditionType: 'threshold',
        operators: ['gt', 'lt', 'gte', 'lte', 'eq'],
        unit: 'Mbps',
        description: 'Network usage from Netdata'
      }
    ]
  },
  unraid: {
    integrationType: 'unraid',
    capabilities: [
      {
        capability: 'cpu_cores',
        displayName: 'CPU Core Count',
        category: 'system',
        conditionType: 'threshold',
        operators: ['gt', 'lt', 'gte', 'lte', 'eq'],
        description: 'Number of CPU cores from Unraid'
      },
      {
        capability: 'memory_usage',
        displayName: 'Memory Usage',
        category: 'system',
        conditionType: 'threshold',
        operators: ['gt', 'lt', 'gte', 'lte', 'eq'],
        unit: '%',
        description: 'RAM usage from Unraid'
      },
      {
        capability: 'disk_usage',
        displayName: 'Disk Usage',
        category: 'system',
        conditionType: 'threshold',
        operators: ['gt', 'lt', 'gte', 'lte', 'eq'],
        unit: '%',
        description: 'Array disk usage from Unraid'
      },
      {
        capability: 'docker_containers',
        displayName: 'Docker Container Count',
        category: 'system',
        conditionType: 'threshold',
        operators: ['gt', 'lt', 'gte', 'lte', 'eq'],
        description: 'Number of running containers'
      },
      {
        capability: 'drive_temperature',
        displayName: 'Drive Temperature',
        category: 'health',
        conditionType: 'threshold',
        operators: ['gt', 'lt', 'gte', 'lte', 'eq'],
        unit: '°C',
        description: 'HDD/SSD temperature from Unraid'
      }
    ]
  },
  'uptime-kuma': {
    integrationType: 'uptime-kuma',
    capabilities: [
      {
        capability: 'service_status',
        displayName: 'Service Status',
        category: 'status',
        conditionType: 'status_change',
        operators: ['eq'],
        description: 'Service up/down status from Uptime Kuma'
      }
    ]
  }
};

/**
 * Metric Registry Class
 */
export class MetricRegistry {
  /**
   * Get all active metric definitions
   */
  static getAllMetrics(): MetricDefinition[] {
    const db = getDb();
    return db
      .prepare(
        `SELECT
          id,
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
        FROM metric_definitions
        WHERE is_active = 1
        ORDER BY integration_type, display_name`
      )
      .all() as MetricDefinition[];
  }

  /**
   * Get metrics filtered by integration type
   */
  static getMetricsByIntegrationType(integrationType: string | null): MetricDefinition[] {
    const db = getDb();

    if (integrationType === null || integrationType === 'all') {
      // Return all metrics
      return this.getAllMetrics();
    }

    return db
      .prepare(
        `SELECT
          id,
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
        FROM metric_definitions
        WHERE is_active = 1
          AND (integration_type = ? OR integration_type IS NULL)
        ORDER BY display_name`
      )
      .all(integrationType) as MetricDefinition[];
  }

  /**
   * Get metric by key
   */
  static getMetricByKey(metricKey: string): MetricDefinition | null {
    const db = getDb();
    return db
      .prepare(
        `SELECT
          id,
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
        FROM metric_definitions
        WHERE metric_key = ? AND is_active = 1
        LIMIT 1`
      )
      .get(metricKey) as MetricDefinition | null;
  }

  /**
   * Get metric by ID
   */
  static getMetricById(id: number): MetricDefinition | null {
    const db = getDb();
    return db
      .prepare(
        `SELECT
          id,
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
        FROM metric_definitions
        WHERE id = ? AND is_active = 1
        LIMIT 1`
      )
      .get(id) as MetricDefinition | null;
  }

  /**
   * Sync driver capabilities with database
   * Called on application startup to ensure all driver capabilities are registered
   */
  static syncDriverCapabilities(): void {
    const db = getDb();
    let syncedCount = 0;
    let skippedCount = 0;

    for (const [driverName, metadata] of Object.entries(DRIVER_REGISTRY)) {
      for (const capability of metadata.capabilities) {
        const metricKey = `${metadata.integrationType}_${capability.capability}`;

        // Check if metric already exists
        const existing = db
          .prepare('SELECT id FROM metric_definitions WHERE metric_key = ?')
          .get(metricKey);

        if (existing) {
          // Update existing metric (in case metadata changed)
          db.prepare(
            `UPDATE metric_definitions
            SET
              display_name = ?,
              integration_type = ?,
              driver_capability = ?,
              category = ?,
              condition_type = ?,
              operators = ?,
              unit = ?,
              description = ?,
              updated_at = datetime('now')
            WHERE metric_key = ?`
          ).run(
            capability.displayName,
            metadata.integrationType,
            capability.capability,
            capability.category,
            capability.conditionType,
            JSON.stringify(capability.operators),
            capability.unit || null,
            capability.description,
            metricKey
          );
          skippedCount++;
        } else {
          // Insert new metric
          db.prepare(
            `INSERT INTO metric_definitions (
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
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
          ).run(
            metricKey,
            capability.displayName,
            metadata.integrationType,
            capability.capability,
            capability.category,
            capability.conditionType,
            JSON.stringify(capability.operators),
            capability.unit || null,
            capability.description
          );
          syncedCount++;
        }
      }
    }

    console.log(
      `[MetricRegistry] Synced driver capabilities: ${syncedCount} new, ${skippedCount} updated`
    );
  }

  /**
   * Register a new driver dynamically
   * Used when drivers are loaded at runtime
   */
  static registerDriver(driverMetadata: DriverMetadata): void {
    DRIVER_REGISTRY[driverMetadata.integrationType] = driverMetadata;
    this.syncDriverCapabilities();
  }

  /**
   * Get list of available integration types
   */
  static getIntegrationTypes(): string[] {
    const db = getDb();
    const results = db
      .prepare(
        `SELECT DISTINCT integration_type
        FROM metric_definitions
        WHERE is_active = 1
          AND integration_type IS NOT NULL
        ORDER BY integration_type`
      )
      .all() as Array<{ integration_type: string }>;

    return results.map((r) => r.integration_type);
  }

  /**
   * Get human-readable operator label
   */
  static getOperatorLabel(operator: string): string {
    const labels: Record<string, string> = {
      gt: 'Greater than (>)',
      lt: 'Less than (<)',
      gte: 'Greater than or equal (≥)',
      lte: 'Less than or equal (≤)',
      eq: 'Equal to (=)'
    };
    return labels[operator] || operator;
  }
}

/**
 * Initialize metric registry on module load
 * This ensures driver capabilities are synced when the app starts
 */
if (typeof window === 'undefined') {
  // Only run on server side
  try {
    MetricRegistry.syncDriverCapabilities();
  } catch (error) {
    console.error('[MetricRegistry] Failed to sync driver capabilities:', error);
  }
}
