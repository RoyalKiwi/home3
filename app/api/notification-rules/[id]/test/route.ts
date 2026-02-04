import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { notificationService } from '@/lib/services/notifications';
import { getDb } from '@/lib/db';
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

    // Get rule details with integration info
    const rule = db
      .prepare(
        `SELECT nr.*, wc.name as webhook_name, i.service_name as integration_name
        FROM notification_rules nr
        JOIN webhook_configs wc ON nr.webhook_id = wc.id
        JOIN integrations i ON nr.integration_id = i.id
        WHERE nr.id = ?`
      )
      .get(ruleId) as any;

    if (!rule) {
      return NextResponse.json({ error: 'Notification rule not found' }, { status: 404 });
    }

    // Get capability metadata for proper unit display
    let unit = '';
    let metricDisplayName = rule.metric_key;
    try {
      const { createDriver } = await import('@/lib/services/driverFactory');
      const { decrypt } = await import('@/lib/crypto');
      const integration = db.prepare('SELECT * FROM integrations WHERE id = ?').get(rule.integration_id) as any;
      if (integration) {
        const credentials = JSON.parse(decrypt(integration.credentials));
        const driver = createDriver(rule.integration_id, integration.service_type, credentials);
        const capabilities = await driver.getCapabilities();
        const capability = capabilities.find((cap: any) => cap.key === rule.metric_key);
        if (capability) {
          metricDisplayName = capability.displayName;
          unit = capability.unit;
        }
      }
    } catch (error) {
      console.warn('[Test] Failed to get capability metadata:', error);
    }

    // Send test notification (bypass flood control)
    await notificationService.sendAlert(
      ruleId,
      {
        alertType: rule.metric_key as MetricType,
        title: `TEST: ${rule.name}`,
        message: `This is a test notification for rule "${rule.name}". If you see this, the rule is configured correctly.\n\nIntegration: ${rule.integration_name}\nMetric: ${rule.metric_key}\nThreshold: ${rule.operator} ${rule.threshold}`,
        severity: rule.severity as Severity,
        metadata: {
          test: true,
          ruleId,
          ruleName: rule.name,
          integrationName: rule.integration_name,
          integrationType: rule.integration_type,
          metricName: rule.metric_key,
          metricDisplayName: metricDisplayName,
          metricValue: rule.threshold * 1.25, // Sample value 25% above threshold
          threshold: rule.threshold,
          unit: unit,
          operator: rule.operator,
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
