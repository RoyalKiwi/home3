import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import type { NotificationTemplate, CreateNotificationTemplateRequest } from '@/lib/types';

/**
 * GET /api/notification-templates
 * List all notification templates (admin-only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const db = getDb();

    const templates = db
      .prepare(
        `SELECT
          id,
          name,
          title_template,
          message_template,
          is_default,
          is_active,
          created_at,
          updated_at
        FROM notification_templates
        WHERE is_active = 1
        ORDER BY is_default DESC, name ASC`
      )
      .all() as NotificationTemplate[];

    return NextResponse.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error('Error fetching notification templates:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to fetch notification templates' }, { status: 500 });
  }
}

/**
 * POST /api/notification-templates
 * Create a new notification template (admin-only)
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const body = (await request.json()) as CreateNotificationTemplateRequest;

    // Validate required fields
    if (!body.name || !body.title_template || !body.message_template) {
      return NextResponse.json(
        { error: 'Missing required fields: name, title_template, message_template' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check if name already exists
    const existing = db
      .prepare('SELECT id FROM notification_templates WHERE name = ?')
      .get(body.name);

    if (existing) {
      return NextResponse.json(
        { error: 'A template with this name already exists' },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults
    if (body.is_default) {
      db.prepare('UPDATE notification_templates SET is_default = 0').run();
    }

    // Insert template
    const result = db
      .prepare(
        `INSERT INTO notification_templates (
          name,
          title_template,
          message_template,
          is_default,
          is_active
        ) VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        body.name,
        body.title_template,
        body.message_template,
        (body.is_default ?? false) ? 1 : 0,
        (body.is_active ?? true) ? 1 : 0
      );

    const template = db
      .prepare('SELECT * FROM notification_templates WHERE id = ?')
      .get(result.lastInsertRowid) as NotificationTemplate;

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('Error creating notification template:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to create notification template' }, { status: 500 });
  }
}
