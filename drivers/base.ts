/**
 * Base Driver Interface
 * All integration drivers must extend this base class
 */

import type {
  IntegrationCredentials,
  IntegrationTestResult,
  MetricCapability,
  MetricData,
} from '@/lib/types';

export abstract class BaseDriver {
  protected credentials: IntegrationCredentials;
  protected integrationId: number;

  /**
   * Capabilities this driver provides
   * Subclasses must define which metrics they can fetch
   */
  abstract readonly capabilities: MetricCapability[];

  /**
   * Human-readable name of the integration type
   */
  abstract readonly displayName: string;

  constructor(integrationId: number, credentials: IntegrationCredentials) {
    this.integrationId = integrationId;
    this.credentials = credentials;
  }

  /**
   * Test if the connection to the service works
   * @returns Test result with success status and message
   */
  abstract testConnection(): Promise<IntegrationTestResult>;

  /**
   * Check if this driver supports a specific metric
   */
  supportsMetric(metric: MetricCapability): boolean {
    return this.capabilities.includes(metric);
  }

  /**
   * Fetch a specific metric
   * Subclasses should implement metric-specific methods
   */
  async fetchMetric(metric: MetricCapability): Promise<MetricData | null> {
    if (!this.supportsMetric(metric)) {
      throw new Error(`Driver ${this.displayName} does not support metric: ${metric}`);
    }

    // Subclasses override this to route to specific metric methods
    return null;
  }

  /**
   * Get integration ID
   */
  getIntegrationId(): number {
    return this.integrationId;
  }

  /**
   * Get supported capabilities
   */
  getCapabilities(): MetricCapability[] {
    return this.capabilities;
  }
}
