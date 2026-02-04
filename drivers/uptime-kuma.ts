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
  CapabilityMetadata,
} from '@/lib/types';

export class UptimeKumaDriver extends BaseDriver {
  readonly displayName = 'Uptime Kuma';

  private get config(): UptimeKumaCredentials {
    return this.credentials as UptimeKumaCredentials;
  }

  /**
   * Parse monitor name from Prometheus label string
   * @param labels - Raw label string like 'monitor_name="Plex",monitor_type="http"'
   * @returns Extracted monitor name or null if not found
   */
  static parseMonitorName(labels: string): string | null {
    const match = labels.match(/monitor_name="([^"]+)"/);
    return match ? match[1] : null;
  }

  /**
   * Test connection to Uptime Kuma
   */
  async testConnection(): Promise<IntegrationTestResult> {
    try {
      // Use /metrics endpoint as it's the most reliable for testing
      const url = `${this.config.url}/metrics`;

      // Uptime Kuma uses HTTP Basic Auth with API key as password
      const auth = Buffer.from(`:${this.config.apiKey}`).toString('base64');

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
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
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  /**
   * Get capabilities dynamically from Uptime Kuma
   * Discovers all monitors via Prometheus metrics
   */
  async getCapabilities(): Promise<CapabilityMetadata[]> {
    const capabilities: CapabilityMetadata[] = [];

    try {
      // Fetch monitor list from Prometheus metrics
      const monitors = await this.fetchMonitorList();

      // Add per-monitor metrics
      for (const monitor of monitors) {
        const target = `monitor_${monitor.name}`;

        // Uptime metric for each monitor
        capabilities.push({
          key: `${target}_uptime`,
          target: target,
          metric: 'uptime',
          displayName: `${monitor.name} Uptime`,
          description: `Uptime percentage for ${monitor.name}`,
          unit: '%',
          category: 'health'
        });

        // Status metric for each monitor
        capabilities.push({
          key: `${target}_status`,
          target: target,
          metric: 'status',
          displayName: `${monitor.name} Status`,
          description: `Health status for ${monitor.name}`,
          unit: 'status',
          category: 'status'
        });
      }

      return capabilities.length > 0 ? capabilities : this.getFallbackCapabilities();
    } catch (error) {
      console.error('[UptimeKumaDriver] Failed to fetch capabilities:', error);
      return this.getFallbackCapabilities();
    }
  }

  /**
   * Get fallback capabilities if API query fails
   */
  private getFallbackCapabilities(): CapabilityMetadata[] {
    // Return empty array - no monitors configured or API unavailable
    return [];
  }

  /**
   * Fetch service uptime/status from Uptime Kuma
   * Note: This parses Prometheus metrics format
   */
  async fetchUptime(): Promise<MetricData> {
    const url = `${this.config.url}/metrics`;
    const auth = Buffer.from(`:${this.config.apiKey}`).toString('base64');

    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch uptime: ${response.statusText}`);
    }

    const metricsText = await response.text();

    // Parse Prometheus metrics to get monitor status
    // Format: monitor_status{monitor_name="...",monitor_type="..."} 1
    const statusMatch = metricsText.match(/monitor_status\{[^}]+\}\s+(\d+)/);
    const allUp = statusMatch ? statusMatch[1] === '1' : false;

    return {
      timestamp: new Date().toISOString(),
      value: allUp,
      unit: 'boolean',
      metadata: { source: 'prometheus_metrics' },
    };
  }

  /**
   * Fetch all monitor statuses from Prometheus metrics
   */
  async fetchServices(): Promise<MetricData> {
    const url = `${this.config.url}/metrics`;
    const auth = Buffer.from(`:${this.config.apiKey}`).toString('base64');

    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch services: ${response.statusText}`);
    }

    const metricsText = await response.text();

    // Parse all monitor_status lines
    const statusRegex = /monitor_status\{([^}]+)\}\s+(\d+)/g;
    const monitors = [];
    let match;

    while ((match = statusRegex.exec(metricsText)) !== null) {
      const labels = match[1];
      const status = match[2];
      monitors.push({ labels, status: status === '1' ? 'up' : 'down' });
    }

    return {
      timestamp: new Date().toISOString(),
      value: JSON.stringify(monitors),
      metadata: { count: monitors.length },
    };
  }

  /**
   * Fetch monitor list with parsed names for status mapping UI
   * @returns Array of monitors with name and status
   */
  async fetchMonitorList(): Promise<{ name: string; status: 'up' | 'down' }[]> {
    const url = `${this.config.url}/metrics`;
    const auth = Buffer.from(`:${this.config.apiKey}`).toString('base64');

    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch monitor list: ${response.statusText}`);
    }

    const metricsText = await response.text();
    const statusRegex = /monitor_status\{([^}]+)\}\s+(\d+)/g;
    const monitors: { name: string; status: 'up' | 'down' }[] = [];
    let match;

    while ((match = statusRegex.exec(metricsText)) !== null) {
      const name = UptimeKumaDriver.parseMonitorName(match[1]);
      if (name) {
        monitors.push({
          name,
          status: match[2] === '1' ? 'up' : 'down',
        });
      }
    }

    return monitors;
  }

  /**
   * Fetch a specific metric by key
   * Routes metric key to appropriate fetch method
   */
  async fetchMetric(key: string): Promise<MetricData | null> {
    try {
      // Route based on metric key pattern
      if (key.endsWith('_uptime')) {
        return await this.fetchUptime();
      } else if (key.endsWith('_status')) {
        return await this.fetchServices();
      }

      // Metric key not implemented yet
      console.warn(`[UptimeKumaDriver] Metric key '${key}' not implemented`);
      return null;
    } catch (error) {
      console.error(`[UptimeKumaDriver] Failed to fetch metric '${key}':`, error);
      return null;
    }
  }

}
