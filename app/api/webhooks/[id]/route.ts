import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { encrypt } from '@/lib/crypto';
import type { UpdateWebhookRequest } from '@/lib/types';

/**
 * PATCH /api/webhooks/[id]
 * Update a webhook (admin-only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();

    const webhookId = parseInt(params.id);
    if (isNaN(webhookId)) {
      return NextResponse.json({ error: 'Invalid webhook ID' }, { status: 400 });
    }

    const body = (await request.json()) as UpdateWebhookRequest;

    const db = getDb();

    // Check if webhook exists
    const existing = db.prepare('SELECT id FROM webhook_configs WHERE id = ?').get(webhookId);
    if (!existing) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name);
    }

    if (body.webhook_url !== undefined) {
      updates.push('webhook_url = ?');
      values.push(encrypt(body.webhook_url));
    }

    if (body.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(body.is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push('updated_at = datetime(\'now\')');
    values.push(webhookId);

    db.prepare(`UPDATE webhook_configs SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db
      .prepare('SELECT id, name, provider_type, is_active, created_at, updated_at FROM webhook_configs WHERE id = ?')
      .get(webhookId);

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Error updating webhook:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to update webhook' }, { status: 500 });
  }
}

/**
 * DELETE /api/webhooks/[id]
 * Delete a webhook (admin-only, cascades to rules)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();

    const webhookId = parseInt(params.id);
    if (isNaN(webhookId)) {
      return NextResponse.json({ error: 'Invalid webhook ID' }, { status: 400 });
    }

    const db = getDb();

    // Check if webhook exists
    const existing = db.prepare('SELECT id, name FROM webhook_configs WHERE id = ?').get(webhookId) as { id: number; name: string } | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    // Check how many rules depend on this webhook
    const ruleCount = db.prepare('SELECT COUNT(*) as count FROM notification_rules WHERE webhook_id = ?').get(webhookId) as { count: number };

    // Delete webhook (will cascade to rules due to FK constraint)
    db.prepare('DELETE FROM webhook_configs WHERE id = ?').run(webhookId);

    return NextResponse.json({
      success: true,
      data: {
        id: webhookId,
        name: existing.name,
        deleted_rules_count: ruleCount.count,
      },
    });
  } catch (error) {
    console.error('Error deleting webhook:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 });
  }
}
