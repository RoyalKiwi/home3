import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import type { NotificationRuleWithWebhook, CreateNotificationRuleRequest } from '@/lib/types';

/**
 * GET /api/notification-rules
 * List all notification rules with webhook details (admin-only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const db = getDb();

    const rules = db
      .prepare(
        `SELECT
          nr.*,
          wc.name as webhook_name,
          wc.provider_type as webhook_provider_type
        FROM notification_rules nr
        JOIN webhook_configs wc ON nr.webhook_id = wc.id
        ORDER BY nr.created_at DESC`
      )
      .all() as NotificationRuleWithWebhook[];

    return NextResponse.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    console.error('Error fetching notification rules:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to fetch notification rules' }, { status: 500 });
  }
}

/**
 * POST /api/notification-rules
 * Create a new notification rule (admin-only)
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const body = (await request.json()) as CreateNotificationRuleRequest;

    // Validate required fields
    if (!body.webhook_id || !body.name || !body.metric_type || !body.condition_type || !body.target_type) {
      return NextResponse.json(
        { error: 'Missing required fields: webhook_id, name, metric_type, condition_type, target_type' },
        { status: 400 }
      );
    }

    // Validate condition-specific fields
    if (body.condition_type === 'threshold') {
      if (body.threshold_value === undefined || !body.threshold_operator) {
        return NextResponse.json(
          { error: 'Threshold rules require threshold_value and threshold_operator' },
          { status: 400 }
        );
      }
    } else if (body.condition_type === 'status_change') {
      // from_status and to_status are optional (NULL means any)
      // But at least one should be specified for meaningful rule
      if (!body.from_status && !body.to_status) {
        return NextResponse.json(
          { error: 'Status change rules should specify at least from_status or to_status' },
          { status: 400 }
        );
      }
    }

    // Validate target
    if (body.target_type !== 'all' && !body.target_id) {
      return NextResponse.json(
        { error: 'target_id is required when target_type is not "all"' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check if webhook exists
    const webhook = db.prepare('SELECT id FROM webhook_configs WHERE id = ?').get(body.webhook_id);
    if (!webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    // Insert rule
    const result = db
      .prepare(
        `INSERT INTO notification_rules (
          webhook_id, name, metric_type, condition_type,
          threshold_value, threshold_operator,
          from_status, to_status,
          target_type, target_id,
          is_active, cooldown_minutes, severity
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        body.webhook_id,
        body.name,
        body.metric_type,
        body.condition_type,
        body.threshold_value ?? null,
        body.threshold_operator ?? null,
        body.from_status ?? null,
        body.to_status ?? null,
        body.target_type,
        body.target_id ?? null,
        body.is_active ?? true,
        body.cooldown_minutes ?? 30,
        body.severity ?? 'warning'
      );

    const rule = db
      .prepare(
        `SELECT
          nr.*,
          wc.name as webhook_name,
          wc.provider_type as webhook_provider_type
        FROM notification_rules nr
        JOIN webhook_configs wc ON nr.webhook_id = wc.id
        WHERE nr.id = ?`
      )
      .get(result.lastInsertRowid) as NotificationRuleWithWebhook;

    return NextResponse.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    console.error('Error creating notification rule:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to create notification rule' }, { status: 500 });
  }
}
