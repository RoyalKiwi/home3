import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { MetricRegistry } from '@/lib/services/metricRegistry';
import type { ParsedMetricDefinition } from '@/lib/types';

/**
 * GET /api/notification-rules/metrics
 * Get metadata about available metric types for notification rules (admin-only)
 * Used by UI to populate dropdowns and show appropriate condition fields
 *
 * Query params:
 *  - integration_type: Filter by integration type (netdata, unraid, uptime-kuma, or "all")
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const integrationType = searchParams.get('integration_type');

    // Get metrics from database via MetricRegistry
    // Filter out legacy metrics (integration_type = NULL) - these are generic placeholders
    const metrics = integrationType
      ? MetricRegistry.getMetricsByIntegrationType(integrationType)
      : MetricRegistry.getAllMetrics().filter(m => m.integration_type !== null);

    // Parse operators JSON string to array for each metric
    const parsedMetrics: ParsedMetricDefinition[] = metrics.map((metric) => ({
      ...metric,
      operators: JSON.parse(metric.operators || '[]'),
    }));

    // Transform to response format compatible with UI
    const response = parsedMetrics.map((metric) => ({
      id: metric.id,
      metricKey: metric.metric_key,
      displayName: metric.display_name,
      integrationType: metric.integration_type,
      driverCapability: metric.driver_capability,
      category: metric.category,
      conditionType: metric.condition_type,
      operators: metric.operators,
      unit: metric.unit,
      description: metric.description,
    }));

    return NextResponse.json({
      success: true,
      data: response,
      meta: {
        total: response.length,
        filtered: !!integrationType,
        integrationType: integrationType || 'all',
      },
    });
  } catch (error) {
    console.error('Error fetching metric metadata:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to fetch metric metadata' }, { status: 500 });
  }
}
