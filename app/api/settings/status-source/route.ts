/**
 * Status Source Settings API
 * GET: Returns current global status source (public)
 * PUT: Sets/clears global status source (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { statusPoller } from '@/lib/services/statusPoller';

/**
 * GET /api/settings/status-source
 * Returns current global status source integration ID (public, no auth)
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();

    const setting = db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get('status_source_id') as { value: string | null } | undefined;

    const integrationId = setting?.value ? parseInt(setting.value, 10) : null;

    return NextResponse.json({
      success: true,
      data: { integration_id: integrationId },
    });
  } catch (error) {
    console.error('[API] GET /api/settings/status-source error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get status source',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/status-source
 * Sets or clears the global status source (admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    await requireAuth();

    const body = await request.json();
    const { integration_id } = body;

    const db = getDb();

    // Validate integration exists if provided
    if (integration_id !== null) {
      const integration = db
        .prepare('SELECT id, service_type FROM integrations WHERE id = ?')
        .get(integration_id) as { id: number; service_type: string } | undefined;

      if (!integration) {
        return NextResponse.json(
          { success: false, error: 'Integration not found' },
          { status: 404 }
        );
      }

      // Only uptime-kuma and unraid support status monitoring
      if (!['uptime-kuma', 'unraid'].includes(integration.service_type)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Only Uptime Kuma and Unraid integrations support status monitoring',
          },
          { status: 400 }
        );
      }
    }

    // Update setting
    const value = integration_id !== null ? String(integration_id) : null;

    db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES ('status_source_id', ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(value);

    // Restart status poller with new config
    await statusPoller.restart();

    return NextResponse.json({
      success: true,
      data: { integration_id },
    });
  } catch (error) {
    console.error('[API] PUT /api/settings/status-source error:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set status source',
      },
      { status: 500 }
    );
  }
}
