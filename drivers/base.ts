/**
 * Base Driver Interface
 * All integration drivers must extend this base class
 */

import type {
  IntegrationCredentials,
  IntegrationTestResult,
  MetricCapability,
  MetricData,
  CapabilityMetadata,
} from '@/lib/types';

export abstract class BaseDriver {
  protected credentials: IntegrationCredentials;
  protected integrationId: number;

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
   * Get integration ID
   */
  getIntegrationId(): number {
    return this.integrationId;
  }

  /**
   * Get supported capabilities (dynamically discovered from integration API)
   * Drivers query their APIs to discover all available metrics
   * @returns Promise resolving to array of capability metadata
   */
  abstract getCapabilities(): Promise<CapabilityMetadata[]>;

  /**
   * Fetch a specific metric by key
   * @param key - The capability key (e.g., 'cpu_usage', 'disk_sda_temp')
   * @returns Metric data or null if not available
   */
  abstract fetchMetric(key: string): Promise<MetricData | null>;
}
