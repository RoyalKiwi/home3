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
} from '@/lib/types';

export class NetdataDriver extends BaseDriver {
  readonly capabilities: MetricCapability[] = ['cpu', 'memory', 'disk', 'network'];
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
   * Route metric requests to appropriate methods
   */
  async fetchMetric(metric: MetricCapability): Promise<MetricData | null> {
    if (!this.supportsMetric(metric)) {
      throw new Error(`Netdata does not support metric: ${metric}`);
    }

    switch (metric) {
      case 'cpu':
        return this.fetchCPU();
      case 'memory':
        return this.fetchMemory();
      case 'disk':
        return this.fetchDisk();
      case 'network':
        return this.fetchNetwork();
      default:
        return null;
    }
  }
}
