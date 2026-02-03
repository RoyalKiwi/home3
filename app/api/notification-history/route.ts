import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/notification-history
 * List notification history with pagination and filtering (admin-only)
 * Query params:
 *   - limit: number of records (default 50, max 200)
 *   - offset: pagination offset (default 0)
 *   - status: filter by status (sent, failed, retrying)
 *   - severity: filter by severity (info, warning, critical)
 *   - rule_id: filter by rule ID
 *   - webhook_id: filter by webhook ID
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);

    // Pagination
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Filters
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const ruleId = searchParams.get('rule_id');
    const webhookId = searchParams.get('webhook_id');

    const db = getDb();

    // Build query with filters
    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (status) {
      conditions.push('nh.status = ?');
      params.push(status);
    }

    if (severity) {
      conditions.push('nh.severity = ?');
      params.push(severity);
    }

    if (ruleId) {
      conditions.push('nh.rule_id = ?');
      params.push(parseInt(ruleId));
    }

    if (webhookId) {
      conditions.push('nh.webhook_id = ?');
      params.push(parseInt(webhookId));
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = db
      .prepare(
        `SELECT COUNT(*) as count
        FROM notification_history nh
        WHERE ${whereClause}`
      )
      .get(...params) as { count: number };

    // Get records
    const records = db
      .prepare(
        `SELECT
          nh.id,
          nh.rule_id,
          nh.webhook_id,
          nh.alert_type,
          nh.title,
          nh.message,
          nh.severity,
          nh.provider_type,
          nh.status,
          nh.attempts,
          nh.error_message,
          nh.sent_at,
          nh.created_at,
          nr.name as rule_name,
          wc.name as webhook_name
        FROM notification_history nh
        LEFT JOIN notification_rules nr ON nh.rule_id = nr.id
        LEFT JOIN webhook_configs wc ON nh.webhook_id = wc.id
        WHERE ${whereClause}
        ORDER BY nh.sent_at DESC
        LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    return NextResponse.json({
      success: true,
      data: records,
      pagination: {
        total: countResult.count,
        limit,
        offset,
        hasMore: offset + limit < countResult.count,
      },
    });
  } catch (error) {
    console.error('Error fetching notification history:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to fetch notification history' }, { status: 500 });
  }
}

/**
 * DELETE /api/notification-history
 * Clear notification history (admin-only)
 * Query params:
 *   - older_than_days: delete records older than X days (default 30)
 */
export async function DELETE(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const olderThanDays = parseInt(searchParams.get('older_than_days') || '30');

    const db = getDb();

    const result = db
      .prepare(
        `DELETE FROM notification_history
        WHERE sent_at < datetime('now', '-' || ? || ' days')`
      )
      .run(olderThanDays);

    return NextResponse.json({
      success: true,
      message: `Deleted ${result.changes} notification history record(s) older than ${olderThanDays} days`,
      deletedCount: result.changes,
    });
  } catch (error) {
    console.error('Error deleting notification history:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to delete notification history' }, { status: 500 });
  }
}
