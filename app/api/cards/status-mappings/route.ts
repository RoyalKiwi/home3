/**
 * Card Status Mappings API
 * GET: Returns all cards with show_status=true and their mappings
 * PUT: Saves card-to-monitor mappings
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { statusPoller } from '@/lib/services/statusPoller';
import type { Card } from '@/lib/types';

/**
 * GET /api/cards/status-mappings
 * Returns all cards that have show_status=true with their current mappings
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const db = getDb();

    const cards = db
      .prepare(`
        SELECT id, name, subcategory_id, show_status,
               status_source_id, status_monitor_name
        FROM cards
        WHERE show_status = 1
        ORDER BY name ASC
      `)
      .all() as Array<Partial<Card>>;

    return NextResponse.json({
      success: true,
      data: cards,
    });
  } catch (error) {
    console.error('[API] GET /api/cards/status-mappings error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get card mappings',
      },
      { status: 500 }
    );
  }
}

interface MappingUpdate {
  card_id: number;
  status_source_id: number | null;
  status_monitor_name: string | null;
}

/**
 * PUT /api/cards/status-mappings
 * Saves card-to-monitor mappings in a transaction
 */
export async function PUT(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body = await request.json();
    const { mappings } = body as { mappings: MappingUpdate[] };

    if (!Array.isArray(mappings)) {
      return NextResponse.json(
        { success: false, error: 'Mappings must be an array' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Perform all updates in a transaction
    const updateStmt = db.prepare(`
      UPDATE cards
      SET status_source_id = ?,
          status_monitor_name = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `);

    const transaction = db.transaction((mappings: MappingUpdate[]) => {
      for (const mapping of mappings) {
        updateStmt.run(
          mapping.status_source_id,
          mapping.status_monitor_name,
          mapping.card_id
        );
      }
    });

    transaction(mappings);

    // Restart status poller to pick up new mappings
    await statusPoller.restart();

    return NextResponse.json({
      success: true,
      data: { updated: mappings.length },
    });
  } catch (error) {
    console.error('[API] PUT /api/cards/status-mappings error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save card mappings',
      },
      { status: 500 }
    );
  }
}
