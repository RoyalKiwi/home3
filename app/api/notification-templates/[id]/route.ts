import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import type { NotificationTemplate, UpdateNotificationTemplateRequest } from '@/lib/types';

/**
 * GET /api/notification-templates/[id]
 * Get a single notification template (admin-only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;
    const templateId = parseInt(id);
    if (isNaN(templateId)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
    }

    const db = getDb();

    const template = db
      .prepare('SELECT * FROM notification_templates WHERE id = ?')
      .get(templateId) as NotificationTemplate | undefined;

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('Error fetching notification template:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to fetch notification template' }, { status: 500 });
  }
}

/**
 * PATCH /api/notification-templates/[id]
 * Update a notification template (admin-only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;
    const templateId = parseInt(id);
    if (isNaN(templateId)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
    }

    const body = (await request.json()) as UpdateNotificationTemplateRequest;

    const db = getDb();

    // Check if template exists
    const existing = db
      .prepare('SELECT id FROM notification_templates WHERE id = ?')
      .get(templateId);

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // If setting as default, unset other defaults
    if (body.is_default === true) {
      db.prepare('UPDATE notification_templates SET is_default = 0 WHERE id != ?').run(templateId);
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (body.name !== undefined) {
      // Check if new name already exists
      const nameExists = db
        .prepare('SELECT id FROM notification_templates WHERE name = ? AND id != ?')
        .get(body.name, templateId);

      if (nameExists) {
        return NextResponse.json(
          { error: 'A template with this name already exists' },
          { status: 400 }
        );
      }

      updates.push('name = ?');
      values.push(body.name);
    }

    if (body.title_template !== undefined) {
      updates.push('title_template = ?');
      values.push(body.title_template);
    }

    if (body.message_template !== undefined) {
      updates.push('message_template = ?');
      values.push(body.message_template);
    }

    if (body.is_default !== undefined) {
      updates.push('is_default = ?');
      values.push(body.is_default ? 1 : 0);
    }

    if (body.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(body.is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push("updated_at = datetime('now')");
    values.push(templateId);

    // Execute update
    db.prepare(
      `UPDATE notification_templates SET ${updates.join(', ')} WHERE id = ?`
    ).run(...values);

    const template = db
      .prepare('SELECT * FROM notification_templates WHERE id = ?')
      .get(templateId) as NotificationTemplate;

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('Error updating notification template:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to update notification template' }, { status: 500 });
  }
}

/**
 * DELETE /api/notification-templates/[id]
 * Delete a notification template (admin-only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;
    const templateId = parseInt(id);
    if (isNaN(templateId)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
    }

    const db = getDb();

    // Check if template exists and is not default
    const template = db
      .prepare('SELECT * FROM notification_templates WHERE id = ?')
      .get(templateId) as NotificationTemplate | undefined;

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (template.is_default) {
      return NextResponse.json(
        { error: 'Cannot delete the default template. Set another template as default first.' },
        { status: 400 }
      );
    }

    // Check if any rules use this template
    const rulesUsingTemplate = db
      .prepare('SELECT COUNT(*) as count FROM notification_rules WHERE template_id = ?')
      .get(templateId) as { count: number };

    if (rulesUsingTemplate.count > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete template. ${rulesUsingTemplate.count} notification rule(s) are using this template.`,
          rulesCount: rulesUsingTemplate.count,
        },
        { status: 400 }
      );
    }

    // Delete template
    db.prepare('DELETE FROM notification_templates WHERE id = ?').run(templateId);

    return NextResponse.json({
      success: true,
      message: `Template "${template.name}" deleted successfully`,
      data: template,
    });
  } catch (error) {
    console.error('Error deleting notification template:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to delete notification template' }, { status: 500 });
  }
}
