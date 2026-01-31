/**
 * Unraid Driver
 * Integrates with Unraid API for system monitoring
 */

import { BaseDriver } from './base';
import type {
  UnraidCredentials,
  IntegrationTestResult,
  MetricCapability,
  MetricData,
} from '@/lib/types';

export class UnraidDriver extends BaseDriver {
  readonly capabilities: MetricCapability[] = [
    'cpu',
    'memory',
    'disk',
    'docker',
    'temperature',
  ];
  readonly displayName = 'Unraid';

  private get config(): UnraidCredentials {
    return this.credentials as UnraidCredentials;
  }

  /**
   * Build authorization header
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    } else if (this.config.username && this.config.password) {
      const auth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }

    return headers;
  }

  /**
   * Test connection to Unraid
   */
  async testConnection(): Promise<IntegrationTestResult> {
    try {
      // Try system info endpoint
      const url = `${this.config.url}/api/v1/system`;

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
        message: `Successfully connected to Unraid server`,
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
   * Fetch CPU usage
   */
  async fetchCPU(): Promise<MetricData> {
    const url = `${this.config.url}/api/v1/system/cpu`;

    const response = await fetch(url, {
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch CPU: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      timestamp: new Date().toISOString(),
      value: data.usage || 0,
      unit: '%',
      metadata: data,
    };
  }

  /**
   * Fetch memory usage
   */
  async fetchMemory(): Promise<MetricData> {
    const url = `${this.config.url}/api/v1/system/memory`;

    const response = await fetch(url, {
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch memory: ${response.statusText}`);
    }

    const data = await response.json();
    const percentage = (data.used / data.total) * 100;

    return {
      timestamp: new Date().toISOString(),
      value: percentage,
      unit: '%',
      metadata: {
        used: data.used,
        total: data.total,
        free: data.free,
      },
    };
  }

  /**
   * Fetch disk usage
   */
  async fetchDisk(): Promise<MetricData> {
    const url = `${this.config.url}/api/v1/system/disks`;

    const response = await fetch(url, {
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch disk: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      timestamp: new Date().toISOString(),
      value: data.usagePercent || 0,
      unit: '%',
      metadata: data,
    };
  }

  /**
   * Fetch Docker container stats
   */
  async fetchDocker(): Promise<MetricData> {
    const url = `${this.config.url}/api/v1/docker/containers`;

    const response = await fetch(url, {
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Docker stats: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      timestamp: new Date().toISOString(),
      value: data.length || 0,
      unit: 'containers',
      metadata: { containers: data },
    };
  }

  /**
   * Fetch system temperature
   */
  async fetchTemperature(): Promise<MetricData> {
    const url = `${this.config.url}/api/v1/system/temperature`;

    const response = await fetch(url, {
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch temperature: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      timestamp: new Date().toISOString(),
      value: data.cpu || 0,
      unit: '°C',
      metadata: data,
    };
  }

  /**
   * Route metric requests to appropriate methods
   */
  async fetchMetric(metric: MetricCapability): Promise<MetricData | null> {
    if (!this.supportsMetric(metric)) {
      throw new Error(`Unraid does not support metric: ${metric}`);
    }

    switch (metric) {
      case 'cpu':
        return this.fetchCPU();
      case 'memory':
        return this.fetchMemory();
      case 'disk':
        return this.fetchDisk();
      case 'docker':
        return this.fetchDocker();
      case 'temperature':
        return this.fetchTemperature();
      default:
        return null;
    }
  }
}
