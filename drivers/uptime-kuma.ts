/**
 * Uptime Kuma Driver
 * Integrates with Uptime Kuma API for service monitoring
 */

import { BaseDriver } from './base';
import type {
  UptimeKumaCredentials,
  IntegrationTestResult,
  MetricCapability,
  MetricData,
} from '@/lib/types';

export class UptimeKumaDriver extends BaseDriver {
  readonly capabilities: MetricCapability[] = ['uptime', 'services'];
  readonly displayName = 'Uptime Kuma';

  private get config(): UptimeKumaCredentials {
    return this.credentials as UptimeKumaCredentials;
  }

  /**
   * Test connection to Uptime Kuma
   */
  async testConnection(): Promise<IntegrationTestResult> {
    try {
      const url = `${this.config.url}/api/status-page/heartbeat`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        return {
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return {
        success: true,
        message: 'Successfully connected to Uptime Kuma',
        data: await response.json(),
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  /**
   * Fetch service uptime/status from Uptime Kuma
   */
  async fetchUptime(): Promise<MetricData> {
    const url = `${this.config.url}/api/status-page/heartbeat`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch uptime: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      timestamp: new Date().toISOString(),
      value: data.status === 'up',
      unit: 'boolean',
      metadata: { rawData: data },
    };
  }

  /**
   * Fetch all monitor statuses
   */
  async fetchServices(): Promise<MetricData> {
    const url = `${this.config.url}/api/status-page`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch services: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      timestamp: new Date().toISOString(),
      value: JSON.stringify(data),
      metadata: { monitors: data },
    };
  }

  /**
   * Route metric requests to appropriate methods
   */
  async fetchMetric(metric: MetricCapability): Promise<MetricData | null> {
    if (!this.supportsMetric(metric)) {
      throw new Error(`Uptime Kuma does not support metric: ${metric}`);
    }

    switch (metric) {
      case 'uptime':
        return this.fetchUptime();
      case 'services':
        return this.fetchServices();
      default:
        return null;
    }
  }
}
