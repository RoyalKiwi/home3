import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { maintenanceSSE } from '@/lib/sse-managers';

/**
 * GET /api/settings/maintenance
 * Get current maintenance mode state (public)
 */
export async function GET() {
  try {
    const db = getDb();

    const setting = db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get('maintenance_mode') as { value: string } | undefined;

    const enabled = setting?.value === 'true';

    return NextResponse.json({
      success: true,
      data: { enabled },
    });
  } catch (error) {
    console.error('Error fetching maintenance mode:', error);
    return NextResponse.json({ error: 'Failed to fetch maintenance mode' }, { status: 500 });
  }
}

/**
 * PATCH /api/settings/maintenance
 * Toggle maintenance mode (admin-only)
 */
export async function PATCH(request: NextRequest) {
  try {
    await requireAuth();

    const body = await request.json();

    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
    }

    const db = getDb();

    // Update maintenance mode setting
    db.prepare(`
      UPDATE settings
      SET value = ?, updated_at = datetime('now')
      WHERE key = 'maintenance_mode'
    `).run(body.enabled ? 'true' : 'false');

    // Broadcast SSE event to all connected clients
    maintenanceSSE.broadcast('MT_STATE_CHANGE', { enabled: body.enabled });

    console.log(`[Maintenance Mode] ${body.enabled ? 'ENABLED' : 'DISABLED'}`);

    return NextResponse.json({
      success: true,
      data: { enabled: body.enabled },
    });
  } catch (error) {
    console.error('Error updating maintenance mode:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to update maintenance mode' }, { status: 500 });
  }
}
