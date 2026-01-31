/**
 * Unraid Driver
 * Integrates with official Unraid GraphQL API for system monitoring
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
   * Execute a GraphQL query against Unraid API
   */
  private async graphqlQuery<T = any>(query: string): Promise<T> {
    const url = `${this.config.url}/graphql`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Unraid official API requires API key authentication
    if (!this.config.apiKey) {
      throw new Error('API key is required for Unraid GraphQL API');
    }

    headers['x-api-key'] = this.config.apiKey;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      // Try to get error details from response body
      let errorDetails = response.statusText;
      try {
        const errorBody = await response.text();
        if (errorBody) {
          errorDetails = errorBody;
        }
      } catch (e) {
        // Ignore if we can't read the body
      }
      throw new Error(`HTTP ${response.status}: ${errorDetails}`);
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(`GraphQL Error: ${result.errors[0].message}`);
    }

    return result.data;
  }

  /**
   * Test connection to Unraid GraphQL API
   */
  async testConnection(): Promise<IntegrationTestResult> {
    try {
      const query = `
        query {
          info {
            os {
              platform
              distro
              release
            }
          }
        }
      `;

      const data = await this.graphqlQuery(query);

      if (!data.info || !data.info.os) {
        return {
          success: false,
          message: 'Invalid response - expected Unraid API data',
        };
      }

      return {
        success: true,
        message: `Connected to Unraid ${data.info.os.distro} ${data.info.os.release}`,
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
   * Fetch CPU info and usage
   */
  async fetchCPU(): Promise<MetricData> {
    const query = `
      query {
        info {
          cpu {
            manufacturer
            brand
            cores
            threads
          }
        }
      }
    `;

    const data = await this.graphqlQuery(query);

    // Note: Unraid API doesn't provide real-time CPU usage percentage
    // We return CPU core count as the value for now
    return {
      timestamp: new Date().toISOString(),
      value: data.info.cpu.cores || 0,
      unit: 'cores',
      metadata: data.info.cpu,
    };
  }

  /**
   * Fetch memory usage
   */
  async fetchMemory(): Promise<MetricData> {
    const query = `
      query {
        info {
          id
          memory {
            total
            free
            used
          }
        }
      }
    `;

    const data = await this.graphqlQuery(query);
    const mem = data.info.memory;
    const percentage = (mem.used / mem.total) * 100;

    return {
      timestamp: new Date().toISOString(),
      value: Math.round(percentage * 100) / 100,
      unit: '%',
      metadata: {
        total: mem.total,
        used: mem.used,
        free: mem.free,
      },
    };
  }

  /**
   * Fetch disk/array usage
   */
  async fetchDisk(): Promise<MetricData> {
    const query = `
      query {
        array {
          state
          capacity {
            disks {
              total
              used
              free
            }
          }
          disks {
            name
            size
            status
            temp
          }
        }
      }
    `;

    const data = await this.graphqlQuery(query);
    const capacity = data.array.capacity.disks;
    const percentage = (capacity.used / capacity.total) * 100;

    return {
      timestamp: new Date().toISOString(),
      value: Math.round(percentage * 100) / 100,
      unit: '%',
      metadata: {
        total: capacity.total,
        used: capacity.used,
        free: capacity.free,
        disks: data.array.disks,
      },
    };
  }

  /**
   * Fetch Docker container stats
   */
  async fetchDocker(): Promise<MetricData> {
    const query = `
      query {
        docker {
          id
          containers {
            id
            names
            state
            status
            autoStart
          }
        }
      }
    `;

    const data = await this.graphqlQuery(query);
    const containers = data.docker?.containers || [];

    // Count running containers
    const running = containers.filter((c: any) => c.state === 'running').length;

    return {
      timestamp: new Date().toISOString(),
      value: running,
      unit: 'running',
      metadata: {
        total: containers.length,
        running,
        containers: containers.map((c: any) => ({
          name: c.names,
          state: c.state,
          status: c.status,
        })),
      },
    };
  }

  /**
   * Fetch system temperature (from disk temps)
   */
  async fetchTemperature(): Promise<MetricData> {
    const query = `
      query {
        array {
          disks {
            name
            temp
          }
        }
      }
    `;

    const data = await this.graphqlQuery(query);
    const disks = data.array.disks || [];

    // Get average disk temperature
    const temps = disks
      .map((d: any) => d.temp)
      .filter((t: any) => t && t > 0);

    const avgTemp = temps.length > 0
      ? temps.reduce((a: number, b: number) => a + b, 0) / temps.length
      : 0;

    return {
      timestamp: new Date().toISOString(),
      value: Math.round(avgTemp * 10) / 10,
      unit: '°C',
      metadata: {
        diskTemps: disks.map((d: any) => ({
          disk: d.name,
          temp: d.temp,
        })),
      },
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
