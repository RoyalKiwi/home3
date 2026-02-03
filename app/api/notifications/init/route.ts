import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { MetricRegistry } from '@/lib/services/metricRegistry';

/**
 * POST /api/notifications/init
 * Initialize/repair notification system data (admin-only)
 * This endpoint can be called to ensure all required data exists
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const db = getDb();
    const results: any = {
      success: true,
      actions: [],
      errors: [],
    };

    // Check and sync metric definitions
    try {
      MetricRegistry.syncDriverCapabilities();
      const metrics = MetricRegistry.getAllMetrics();
      results.actions.push(`Synced ${metrics.length} metric definitions`);
    } catch (error) {
      results.errors.push(`Failed to sync metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Check templates exist
    try {
      const templateCount = db.prepare('SELECT COUNT(*) as count FROM notification_templates').get() as { count: number };

      if (templateCount.count === 0) {
        // Seed default templates
        const defaultTemplates = [
          {
            name: 'Default System Template',
            title: '{{severity}} Alert: {{metricName}}',
            message: '{{integrationName}} - {{metricDisplayName}} is {{metricValue}}{{unit}} (threshold: {{threshold}}{{unit}})',
            isDefault: 1,
          },
          {
            name: 'Detailed Alert',
            title: '🚨 {{severity}} Alert: {{metricName}}',
            message: `Alert triggered for {{cardName}}

**Metric**: {{metricDisplayName}}
**Current Value**: {{metricValue}}{{unit}}
**Threshold**: {{threshold}}{{unit}}
**Source**: {{integrationName}}
**Time**: {{timestamp}}

Please investigate immediately.`,
            isDefault: 0,
          },
          {
            name: 'Minimal Alert',
            title: '{{metricName}}',
            message: '{{metricValue}}{{unit}} ({{threshold}}{{unit}})',
            isDefault: 0,
          },
          {
            name: 'Status Change Alert',
            title: '{{cardName}} Status Changed',
            message: `{{cardName}} status changed from {{oldStatus}} to {{newStatus}}

**Time**: {{timestamp}}`,
            isDefault: 0,
          },
          {
            name: 'Critical Alert (Emoji)',
            title: '🔴 CRITICAL: {{metricName}}',
            message: `⚠️ **CRITICAL ALERT** ⚠️

**System**: {{cardName}}
**Issue**: {{metricDisplayName}} at {{metricValue}}{{unit}}
**Threshold**: {{threshold}}{{unit}}
**Severity**: {{severity}}

🚨 Immediate action required!`,
            isDefault: 0,
          },
        ];

        for (const template of defaultTemplates) {
          db.prepare(`
            INSERT INTO notification_templates (name, title_template, message_template, is_default, is_active)
            VALUES (?, ?, ?, ?, 1)
          `).run(template.name, template.title, template.message, template.isDefault);
        }

        results.actions.push(`Seeded ${defaultTemplates.length} default templates`);
      } else {
        results.actions.push(`Templates already exist (${templateCount.count} templates)`);
      }
    } catch (error) {
      results.errors.push(`Failed to seed templates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Check notification_history table exists
    try {
      db.prepare('SELECT COUNT(*) FROM notification_history LIMIT 1').get();
      results.actions.push('notification_history table exists');
    } catch (error) {
      results.errors.push('notification_history table missing - run migration 011');
    }

    results.success = results.errors.length === 0;

    return NextResponse.json({
      success: results.success,
      data: results,
    });
  } catch (error) {
    console.error('Error initializing notification system:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      {
        error: 'Failed to initialize notification system',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/notifications/init
 * Check notification system health (admin-only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const db = getDb();
    const status: any = {
      healthy: true,
      checks: [],
    };

    // Check tables exist
    const tables = ['webhook_configs', 'notification_rules', 'metric_definitions', 'notification_templates', 'notification_history'];

    for (const table of tables) {
      try {
        const result = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
        status.checks.push({
          name: `Table: ${table}`,
          status: result ? 'ok' : 'missing',
          healthy: !!result,
        });
        if (!result) status.healthy = false;
      } catch (error) {
        status.checks.push({
          name: `Table: ${table}`,
          status: 'error',
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        status.healthy = false;
      }
    }

    // Check metrics
    try {
      const metrics = MetricRegistry.getAllMetrics();
      status.checks.push({
        name: 'Metric Definitions',
        status: metrics.length > 0 ? 'ok' : 'empty',
        healthy: metrics.length > 0,
        count: metrics.length,
      });
      if (metrics.length === 0) status.healthy = false;
    } catch (error) {
      status.checks.push({
        name: 'Metric Definitions',
        status: 'error',
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      status.healthy = false;
    }

    // Check templates
    try {
      const templates = db.prepare('SELECT COUNT(*) as count FROM notification_templates').get() as { count: number };
      status.checks.push({
        name: 'Notification Templates',
        status: templates.count > 0 ? 'ok' : 'empty',
        healthy: templates.count > 0,
        count: templates.count,
      });
      if (templates.count === 0) status.healthy = false;
    } catch (error) {
      status.checks.push({
        name: 'Notification Templates',
        status: 'error',
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      status.healthy = false;
    }

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Error checking notification system health:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to check notification system health' }, { status: 500 });
  }
}
