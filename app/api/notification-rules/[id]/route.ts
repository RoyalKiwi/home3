import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import type { UpdateNotificationRuleRequest } from '@/lib/types';

/**
 * PATCH /api/notification-rules/[id]
 * Update a notification rule (admin-only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();

    const ruleId = parseInt(params.id);
    if (isNaN(ruleId)) {
      return NextResponse.json({ error: 'Invalid rule ID' }, { status: 400 });
    }

    const body = (await request.json()) as UpdateNotificationRuleRequest;

    const db = getDb();

    // Check if rule exists
    const existing = db.prepare('SELECT id FROM notification_rules WHERE id = ?').get(ruleId);
    if (!existing) {
      return NextResponse.json({ error: 'Notification rule not found' }, { status: 404 });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (body.webhook_id !== undefined) {
      updates.push('webhook_id = ?');
      values.push(body.webhook_id);
    }

    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name);
    }

    if (body.metric_type !== undefined) {
      updates.push('metric_type = ?');
      values.push(body.metric_type);
    }

    if (body.condition_type !== undefined) {
      updates.push('condition_type = ?');
      values.push(body.condition_type);
    }

    if (body.threshold_value !== undefined) {
      updates.push('threshold_value = ?');
      values.push(body.threshold_value);
    }

    if (body.threshold_operator !== undefined) {
      updates.push('threshold_operator = ?');
      values.push(body.threshold_operator);
    }

    if (body.from_status !== undefined) {
      updates.push('from_status = ?');
      values.push(body.from_status);
    }

    if (body.to_status !== undefined) {
      updates.push('to_status = ?');
      values.push(body.to_status);
    }

    if (body.target_type !== undefined) {
      updates.push('target_type = ?');
      values.push(body.target_type);
    }

    if (body.target_id !== undefined) {
      updates.push('target_id = ?');
      values.push(body.target_id);
    }

    if (body.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(body.is_active ? 1 : 0);
    }

    if (body.cooldown_minutes !== undefined) {
      updates.push('cooldown_minutes = ?');
      values.push(body.cooldown_minutes);
    }

    if (body.severity !== undefined) {
      updates.push('severity = ?');
      values.push(body.severity);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push('updated_at = datetime(\'now\')');
    values.push(ruleId);

    db.prepare(`UPDATE notification_rules SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db
      .prepare(
        `SELECT
          nr.*,
          wc.name as webhook_name,
          wc.provider_type as webhook_provider_type
        FROM notification_rules nr
        JOIN webhook_configs wc ON nr.webhook_id = wc.id
        WHERE nr.id = ?`
      )
      .get(ruleId);

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Error updating notification rule:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to update notification rule' }, { status: 500 });
  }
}

/**
 * DELETE /api/notification-rules/[id]
 * Delete a notification rule (admin-only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();

    const ruleId = parseInt(params.id);
    if (isNaN(ruleId)) {
      return NextResponse.json({ error: 'Invalid rule ID' }, { status: 400 });
    }

    const db = getDb();

    // Check if rule exists
    const existing = db.prepare('SELECT id, name FROM notification_rules WHERE id = ?').get(ruleId) as { id: number; name: string } | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'Notification rule not found' }, { status: 404 });
    }

    // Delete rule
    db.prepare('DELETE FROM notification_rules WHERE id = ?').run(ruleId);

    return NextResponse.json({
      success: true,
      data: {
        id: ruleId,
        name: existing.name,
      },
    });
  } catch (error) {
    console.error('Error deleting notification rule:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to delete notification rule' }, { status: 500 });
  }
}
