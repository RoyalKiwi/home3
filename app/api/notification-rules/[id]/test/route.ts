import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { notificationService } from '@/lib/services/notifications';
import { getDb } from '@/lib/db';
import { MetricRegistry } from '@/lib/services/metricRegistry';
import type { Severity, MetricType } from '@/lib/types';

/**
 * POST /api/notification-rules/[id]/test
 * Test a notification rule by triggering it immediately (admin-only, bypasses flood control)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;
    const ruleId = parseInt(id);
    if (isNaN(ruleId)) {
      return NextResponse.json({ error: 'Invalid rule ID' }, { status: 400 });
    }

    const db = getDb();

    // Get rule details
    const rule = db
      .prepare(
        `SELECT nr.*, wc.name as webhook_name
        FROM notification_rules nr
        JOIN webhook_configs wc ON nr.webhook_id = wc.id
        WHERE nr.id = ?`
      )
      .get(ruleId) as any;

    if (!rule) {
      return NextResponse.json({ error: 'Notification rule not found' }, { status: 404 });
    }

    // Get metric key for alertType (support both legacy and new system)
    let metricKey = rule.metric_type;

    // If using new metric_definition_id, look up the metric key
    if (!metricKey && rule.metric_definition_id) {
      const metricDef = MetricRegistry.getMetricById(rule.metric_definition_id);
      metricKey = metricDef?.metric_key || 'unknown_metric';
    }

    // Send test notification (bypass flood control)
    await notificationService.sendAlert(
      ruleId,
      {
        alertType: metricKey as MetricType,
        title: `TEST: ${rule.name}`,
        message: `This is a test notification for rule "${rule.name}". If you see this, the rule is configured correctly.`,
        severity: rule.severity as Severity,
        metadata: {
          test: true,
          ruleId,
          ruleName: rule.name,
          metricDefinitionId: rule.metric_definition_id,
        },
      },
      true // Bypass flood control
    );

    return NextResponse.json({
      success: true,
      message: `Test notification sent via ${rule.webhook_name}`,
    });
  } catch (error) {
    console.error('Error testing notification rule:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to test notification rule', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
