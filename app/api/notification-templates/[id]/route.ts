import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * PATCH /api/notification-templates/[id]
 * Update an existing notification template
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();

    const body = await request.json();
    const db = getDb();

    // Validate required fields
    if (!body.name || !body.title_template || !body.message_template) {
      return NextResponse.json(
        { error: 'Missing required fields: name, title_template, message_template' },
        { status: 400 }
      );
    }

    // Check if template exists
    const existing = db.prepare(
      'SELECT id FROM notification_templates WHERE id = ?'
    ).get(params.id);

    if (!existing) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // If setting as default, unset other defaults
    if (body.is_default) {
      db.prepare(
        'UPDATE notification_templates SET is_default = 0 WHERE is_default = 1'
      ).run();
    }

    // Update the template
    db.prepare(\`
      UPDATE notification_templates
      SET
        name = ?,
        title_template = ?,
        message_template = ?,
        is_default = ?,
        is_active = ?,
        updated_at = datetime('now')
      WHERE id = ?
    \`).run(
      body.name,
      body.title_template,
      body.message_template,
      body.is_default ? 1 : 0,
      body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1,
      params.id
    );

    // Fetch updated template
    const updated = db.prepare(
      'SELECT * FROM notification_templates WHERE id = ?'
    ).get(params.id);

    return NextResponse.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('Error updating notification template:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      {
        error: 'Failed to update template',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notification-templates/[id]
 * Delete a notification template
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();

    const db = getDb();

    // Check if template exists
    const template = db.prepare(
      'SELECT id, name, is_default FROM notification_templates WHERE id = ?'
    ).get(params.id) as { id: number; name: string; is_default: number } | undefined;

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Prevent deletion of default template
    if (template.is_default) {
      return NextResponse.json(
        { error: 'Cannot delete the default template. Set another template as default first.' },
        { status: 400 }
      );
    }

    // Check if template is being used by any notification rules
    const usage = db.prepare(
      'SELECT COUNT(*) as count FROM notification_rules WHERE template_id = ?'
    ).get(params.id) as { count: number };

    if (usage.count > 0) {
      return NextResponse.json(
        {
          error: \`Template "\${template.name}" is used by \${usage.count} notification rule(s). Remove it from rules before deleting.\`
        },
        { status: 400 }
      );
    }

    // Delete the template
    db.prepare('DELETE FROM notification_templates WHERE id = ?').run(params.id);

    return NextResponse.json({
      success: true,
      message: \`Template "\${template.name}" deleted successfully\`
    });
  } catch (error) {
    console.error('Error deleting notification template:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      {
        error: 'Failed to delete template',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
