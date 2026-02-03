import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/notification-history/stats
 * Get notification history statistics (admin-only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const db = getDb();

    // Overall stats
    const overall = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'retrying' THEN 1 ELSE 0 END) as retrying
      FROM notification_history
    `).get() as any;

    // Last 24 hours
    const last24h = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM notification_history
      WHERE sent_at >= datetime('now', '-1 day')
    `).get() as any;

    // Last 7 days
    const last7d = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM notification_history
      WHERE sent_at >= datetime('now', '-7 days')
    `).get() as any;

    // By severity
    const bySeverity = db.prepare(`
      SELECT
        severity,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM notification_history
      WHERE sent_at >= datetime('now', '-7 days')
      GROUP BY severity
      ORDER BY severity
    `).all() as any[];

    // By provider
    const byProvider = db.prepare(`
      SELECT
        provider_type,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM notification_history
      WHERE sent_at >= datetime('now', '-7 days')
      GROUP BY provider_type
      ORDER BY count DESC
    `).all() as any[];

    // Top rules (most triggered)
    const topRules = db.prepare(`
      SELECT
        nh.rule_id,
        nr.name as rule_name,
        COUNT(*) as count,
        SUM(CASE WHEN nh.status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN nh.status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM notification_history nh
      LEFT JOIN notification_rules nr ON nh.rule_id = nr.id
      WHERE nh.sent_at >= datetime('now', '-7 days')
      GROUP BY nh.rule_id
      ORDER BY count DESC
      LIMIT 10
    `).all() as any[];

    // Recent failures
    const recentFailures = db.prepare(`
      SELECT
        nh.id,
        nh.rule_id,
        nh.title,
        nh.error_message,
        nh.sent_at,
        nr.name as rule_name
      FROM notification_history nh
      LEFT JOIN notification_rules nr ON nh.rule_id = nr.id
      WHERE nh.status = 'failed'
      ORDER BY nh.sent_at DESC
      LIMIT 10
    `).all() as any[];

    return NextResponse.json({
      success: true,
      data: {
        overall,
        last24h,
        last7d,
        bySeverity,
        byProvider,
        topRules,
        recentFailures,
      },
    });
  } catch (error) {
    console.error('Error fetching notification history stats:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to fetch notification history stats' }, { status: 500 });
  }
}
