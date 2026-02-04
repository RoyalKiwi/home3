/**
 * Netdata Driver
 * Integrates with Netdata API for system monitoring
 */

import { BaseDriver } from './base';
import type {
  NetdataCredentials,
  IntegrationTestResult,
  MetricCapability,
  MetricData,
  CapabilityMetadata,
} from '@/lib/types';

export class NetdataDriver extends BaseDriver {
  readonly displayName = 'Netdata';

  private get config(): NetdataCredentials {
    return this.credentials as NetdataCredentials;
  }

  /**
   * Build authorization header if credentials provided
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.config.username && this.config.password) {
      const auth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }

    return headers;
  }

  /**
   * Test connection to Netdata
   */
  async testConnection(): Promise<IntegrationTestResult> {
    try {
      const url = `${this.config.url}/api/v1/info`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return {
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();

      return {
        success: true,
        message: `Successfully connected to Netdata (v${data.version})`,
        data,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  /**
   * Get capabilities dynamically from Netdata API
   * Queries /api/v1/charts to discover all available metrics
   */
  async getCapabilities(): Promise<CapabilityMetadata[]> {
    const capabilities: CapabilityMetadata[] = [];

    try {
      // Query Netdata API for all available charts
      const url = `${this.config.url}/api/v1/charts`;
      const response = await fetch(url, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        console.error('[NetdataDriver] Failed to fetch charts:', response.statusText);
        return this.getFallbackCapabilities();
      }

      const data = await response.json();

      // Transform each chart into capability metadata
      for (const [chartId, chartInfo] of Object.entries(data.charts || {})) {
        const capability = this.mapNetdataChartToCapability(chartId, chartInfo as any);
        if (capability) {
          capabilities.push(capability);
        }
      }

      return capabilities.length > 0 ? capabilities : this.getFallbackCapabilities();
    } catch (error) {
      console.error('[NetdataDriver] Failed to fetch capabilities:', error);
      return this.getFallbackCapabilities();
    }
  }

  /**
   * Map Netdata chart ID to capability metadata
   */
  private mapNetdataChartToCapability(chartId: string, chartInfo: any): CapabilityMetadata | null {
    // Map Netdata chart IDs to friendly capability metadata
    const mappings: Record<string, { target: string; metric: string; displayName: string; unit: string; category: string }> = {
      'system.cpu': { target: 'cpu', metric: 'usage', displayName: 'CPU Usage', unit: '%', category: 'performance' },
      'system.ram': { target: 'memory', metric: 'usage', displayName: 'RAM Usage', unit: '%', category: 'performance' },
      'system.load': { target: 'system', metric: 'load', displayName: 'System Load', unit: 'load', category: 'health' },
      'sensors.temp': { target: 'cpu', metric: 'temp', displayName: 'CPU Temperature', unit: '°C', category: 'health' },
      'disk_space._': { target: 'disk', metric: 'usage', displayName: 'Disk Space', unit: '%', category: 'performance' },
      'disk.io': { target: 'disk', metric: 'io', displayName: 'Disk I/O', unit: 'KB/s', category: 'performance' },
      'system.net': { target: 'network', metric: 'bandwidth', displayName: 'Network Bandwidth', unit: 'Mbps', category: 'performance' },
      'net.packets': { target: 'network', metric: 'packets', displayName: 'Network Packets', unit: 'pps', category: 'performance' },
    };

    const mapping = mappings[chartId];
    if (!mapping) {
      return null; // Skip unmapped charts
    }

    return {
      key: `${mapping.target}_${mapping.metric}`,
      target: mapping.target,
      metric: mapping.metric,
      displayName: mapping.displayName,
      description: chartInfo.title || mapping.displayName,
      unit: mapping.unit,
      category: mapping.category as 'performance' | 'health' | 'status',
    };
  }

  /**
   * Get fallback capabilities if API query fails
   */
  private getFallbackCapabilities(): CapabilityMetadata[] {
    return [
      { key: 'cpu_usage', target: 'cpu', metric: 'usage', displayName: 'CPU Usage', description: 'CPU utilization percentage', unit: '%', category: 'performance' },
      { key: 'memory_usage', target: 'memory', metric: 'usage', displayName: 'RAM Usage', description: 'Memory utilization percentage', unit: '%', category: 'performance' },
      { key: 'disk_usage', target: 'disk', metric: 'usage', displayName: 'Disk Space', description: 'Disk space usage percentage', unit: '%', category: 'performance' },
    ];
  }

  /**
   * Fetch CPU usage percentage
   */
  async fetchCPU(): Promise<MetricData> {
    const url = `${this.config.url}/api/v1/data?chart=system.cpu&points=1`;

    const response = await fetch(url, {
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch CPU: ${response.statusText}`);
    }

    const data = await response.json();
    const cpuValue = data.data[0][1]; // Get latest CPU value

    return {
      timestamp: new Date().toISOString(),
      value: parseFloat(cpuValue),
      unit: '%',
      metadata: { chart: 'system.cpu' },
    };
  }

  /**
   * Fetch memory usage
   */
  async fetchMemory(): Promise<MetricData> {
    const url = `${this.config.url}/api/v1/data?chart=system.ram&points=1`;

    const response = await fetch(url, {
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch memory: ${response.statusText}`);
    }

    const data = await response.json();
    const memUsed = data.data[0][1];
    const memFree = data.data[0][2];
    const total = memUsed + memFree;
    const percentage = (memUsed / total) * 100;

    return {
      timestamp: new Date().toISOString(),
      value: percentage,
      unit: '%',
      metadata: {
        used: memUsed,
        free: memFree,
        total,
      },
    };
  }

  /**
   * Fetch disk usage
   */
  async fetchDisk(): Promise<MetricData> {
    const url = `${this.config.url}/api/v1/data?chart=disk_space._&points=1`;

    const response = await fetch(url, {
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch disk: ${response.statusText}`);
    }

    const data = await response.json();
    const diskUsed = data.data[0][1];

    return {
      timestamp: new Date().toISOString(),
      value: parseFloat(diskUsed),
      unit: '%',
      metadata: { chart: 'disk_space' },
    };
  }

  /**
   * Fetch network stats
   */
  async fetchNetwork(): Promise<MetricData> {
    const url = `${this.config.url}/api/v1/data?chart=system.net&points=1`;

    const response = await fetch(url, {
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch network: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      timestamp: new Date().toISOString(),
      value: JSON.stringify(data.data[0]),
      metadata: { chart: 'system.net', rawData: data },
    };
  }

  /**
   * Fetch a specific metric by key
   * Routes metric key to appropriate fetch method
   */
  async fetchMetric(key: string): Promise<MetricData | null> {
    try {
      // Route based on metric key pattern
      if (key === 'cpu_usage') {
        return await this.fetchCPU();
      } else if (key === 'memory_usage') {
        return await this.fetchMemory();
      } else if (key === 'disk_usage') {
        return await this.fetchDisk();
      } else if (key.startsWith('network_')) {
        return await this.fetchNetwork();
      }

      // Metric key not implemented yet
      console.warn(`[NetdataDriver] Metric key '${key}' not implemented`);
      return null;
    } catch (error) {
      console.error(`[NetdataDriver] Failed to fetch metric '${key}':`, error);
      return null;
    }
  }

}
