import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import type { MetricMetadata } from '@/lib/types';

/**
 * GET /api/notification-rules/metrics
 * Get metadata about available metric types for notification rules (admin-only)
 * Used by UI to populate dropdowns and show appropriate condition fields
 */
export async function GET() {
  try {
    await requireAuth();

    const metrics: MetricMetadata[] = [
      // Status Change Metrics
      {
        type: 'server_offline',
        displayName: 'Server Offline',
        category: 'status',
        conditionType: 'status_change',
        description: 'Triggered when a card status changes from online to offline',
      },
      {
        type: 'server_online',
        displayName: 'Server Online',
        category: 'status',
        conditionType: 'status_change',
        description: 'Triggered when a card status changes from offline to online (recovery)',
      },
      {
        type: 'server_warning',
        displayName: 'Server Warning',
        category: 'status',
        conditionType: 'status_change',
        description: 'Triggered when a card status becomes warning (integration unreachable)',
      },

      // Performance Metrics (Threshold)
      {
        type: 'cpu_temperature',
        displayName: 'CPU Temperature',
        category: 'performance',
        conditionType: 'threshold',
        operators: ['gt', 'lt', 'gte', 'lte', 'eq'],
        unit: '°C',
        description: 'Monitor CPU temperature and alert when threshold is exceeded',
      },
      {
        type: 'cpu_usage',
        displayName: 'CPU Usage',
        category: 'performance',
        conditionType: 'threshold',
        operators: ['gt', 'lt', 'gte', 'lte', 'eq'],
        unit: '%',
        description: 'Monitor CPU usage percentage',
      },
      {
        type: 'memory_usage',
        displayName: 'Memory Usage',
        category: 'performance',
        conditionType: 'threshold',
        operators: ['gt', 'lt', 'gte', 'lte', 'eq'],
        unit: '%',
        description: 'Monitor RAM usage percentage',
      },
      {
        type: 'disk_usage',
        displayName: 'Disk Usage',
        category: 'performance',
        conditionType: 'threshold',
        operators: ['gt', 'lt', 'gte', 'lte', 'eq'],
        unit: '%',
        description: 'Monitor disk space usage percentage',
      },
      {
        type: 'network_bandwidth',
        displayName: 'Network Bandwidth',
        category: 'performance',
        conditionType: 'threshold',
        operators: ['gt', 'lt', 'gte', 'lte', 'eq'],
        unit: 'Mbps',
        description: 'Monitor network bandwidth usage',
      },

      // Health Metrics (Threshold)
      {
        type: 'drive_temperature',
        displayName: 'Drive Temperature',
        category: 'health',
        conditionType: 'threshold',
        operators: ['gt', 'lt', 'gte', 'lte', 'eq'],
        unit: '°C',
        description: 'Monitor HDD/SSD temperature',
      },
      {
        type: 'ups_battery_level',
        displayName: 'UPS Battery Level',
        category: 'health',
        conditionType: 'threshold',
        operators: ['lt', 'lte', 'eq'],
        unit: '%',
        description: 'Monitor UPS battery percentage',
      },
      {
        type: 'array_status',
        displayName: 'Array Status',
        category: 'health',
        conditionType: 'status_change',
        description: 'Monitor Unraid array status (parity errors, disk failures)',
      },
      {
        type: 'docker_container_status',
        displayName: 'Docker Container Status',
        category: 'health',
        conditionType: 'status_change',
        description: 'Monitor Docker container start/stop events',
      },
    ];

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Error fetching metric metadata:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to fetch metric metadata' }, { status: 500 });
  }
}
