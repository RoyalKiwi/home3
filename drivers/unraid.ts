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
  CapabilityMetadata,
} from '@/lib/types';

export class UnraidDriver extends BaseDriver {
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
   * Get capabilities dynamically from Unraid GraphQL API
   * Discovers all disks, containers, and VMs
   */
  async getCapabilities(): Promise<CapabilityMetadata[]> {
    const capabilities: CapabilityMetadata[] = [];

    try {
      // Base system metrics (always available)
      capabilities.push(
        { key: 'cpu_usage', target: 'cpu', metric: 'usage', displayName: 'CPU Usage', description: 'CPU utilization percentage', unit: '%', category: 'performance' },
        { key: 'cpu_temp', target: 'cpu', metric: 'temp', displayName: 'CPU Temperature', description: 'CPU temperature', unit: '°C', category: 'health' },
        { key: 'memory_usage', target: 'memory', metric: 'usage', displayName: 'RAM Usage', description: 'Memory utilization percentage', unit: '%', category: 'performance' },
        { key: 'array_status', target: 'array', metric: 'status', displayName: 'Array Status', description: 'Array health status', unit: 'status', category: 'health' }
      );

      // Query for disks and containers dynamically
      const [disks, containers] = await Promise.all([
        this.fetchDisksList(),
        this.fetchContainersList(),
      ]);

      // Add per-disk metrics
      for (const disk of disks) {
        capabilities.push({
          key: `disk_${disk.name}_usage`,
          target: `disk_${disk.name}`,
          metric: 'usage',
          displayName: `${disk.name} Usage`,
          description: `Disk space usage for ${disk.name}`,
          unit: '%',
          category: 'performance'
        });

        if (disk.hasTemp) {
          capabilities.push({
            key: `disk_${disk.name}_temp`,
            target: `disk_${disk.name}`,
            metric: 'temp',
            displayName: `${disk.name} Temperature`,
            description: `Temperature for ${disk.name}`,
            unit: '°C',
            category: 'health'
          });
        }
      }

      // Add per-container metrics
      for (const container of containers) {
        capabilities.push({
          key: `docker_${container.name}_status`,
          target: `docker_${container.name}`,
          metric: 'status',
          displayName: `Docker: ${container.name}`,
          description: `Status of Docker container ${container.name}`,
          unit: 'status',
          category: 'status'
        });
      }

      // Add parity metrics if parity disk exists
      if (disks.some(d => d.isParity)) {
        capabilities.push(
          { key: 'parity_errors', target: 'parity', metric: 'errors', displayName: 'Parity Errors', description: 'Parity check error count', unit: 'errors', category: 'health' },
          { key: 'parity_status', target: 'parity', metric: 'status', displayName: 'Parity Status', description: 'Parity check status', unit: 'status', category: 'health' }
        );
      }

      return capabilities.length > 0 ? capabilities : this.getFallbackCapabilities();
    } catch (error) {
      console.error('[UnraidDriver] Failed to fetch capabilities:', error);
      return this.getFallbackCapabilities();
    }
  }

  /**
   * Fetch list of disks from Unraid API
   */
  private async fetchDisksList(): Promise<Array<{ name: string; hasTemp: boolean; isParity: boolean }>> {
    try {
      const query = `
        query {
          array {
            disks {
              name
              temp
              status
            }
          }
        }
      `;

      const data = await this.graphqlQuery(query);
      const disks = data.array?.disks || [];

      return disks.map((disk: any) => ({
        name: disk.name,
        hasTemp: disk.temp !== null && disk.temp !== undefined,
        isParity: disk.name?.toLowerCase().includes('parity') || false,
      }));
    } catch (error) {
      console.error('[UnraidDriver] Failed to fetch disks list:', error);
      return [];
    }
  }

  /**
   * Fetch list of Docker containers from Unraid API
   */
  private async fetchContainersList(): Promise<Array<{ name: string }>> {
    try {
      const query = `
        query {
          docker {
            containers {
              id
              names
            }
          }
        }
      `;

      const data = await this.graphqlQuery(query);
      const containers = data.docker?.containers || [];

      return containers.map((container: any) => ({
        name: container.names || container.id,
      }));
    } catch (error) {
      console.error('[UnraidDriver] Failed to fetch containers list:', error);
      return [];
    }
  }

  /**
   * Get fallback capabilities if API query fails
   */
  private getFallbackCapabilities(): CapabilityMetadata[] {
    return [
      { key: 'cpu_usage', target: 'cpu', metric: 'usage', displayName: 'CPU Usage', description: 'CPU utilization percentage', unit: '%', category: 'performance' },
      { key: 'memory_usage', target: 'memory', metric: 'usage', displayName: 'RAM Usage', description: 'Memory utilization percentage', unit: '%', category: 'performance' },
      { key: 'array_status', target: 'array', metric: 'status', displayName: 'Array Status', description: 'Array health status', unit: 'status', category: 'health' },
    ];
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
            memTotal
            memFree
            memUsed
            memAvailable
          }
        }
      }
    `;

    const data = await this.graphqlQuery(query);
    const mem = data.info.memory;
    const percentage = (mem.memUsed / mem.memTotal) * 100;

    return {
      timestamp: new Date().toISOString(),
      value: Math.round(percentage * 100) / 100,
      unit: '%',
      metadata: {
        total: mem.memTotal,
        used: mem.memUsed,
        free: mem.memFree,
        available: mem.memAvailable,
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
   * Fetch a specific metric by key
   * Routes metric key to appropriate fetch method
   */
  async fetchMetric(key: string): Promise<MetricData | null> {
    try {
      // System metrics
      if (key === 'cpu_usage') {
        return await this.fetchCPU();
      } else if (key === 'cpu_temp') {
        return await this.fetchTemperature();
      } else if (key === 'memory_usage') {
        return await this.fetchMemory();
      } else if (key.startsWith('disk_') && key.endsWith('_usage')) {
        return await this.fetchDisk();
      } else if (key.startsWith('disk_') && key.endsWith('_temp')) {
        return await this.fetchTemperature();
      } else if (key.startsWith('docker_')) {
        return await this.fetchDocker();
      }

      // Metric key not implemented yet
      console.warn(`[UnraidDriver] Metric key '${key}' not implemented`);
      return null;
    } catch (error) {
      console.error(`[UnraidDriver] Failed to fetch metric '${key}':`, error);
      return null;
    }
  }

}
