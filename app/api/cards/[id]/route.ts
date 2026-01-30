import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import {
  validateString,
  validateInteger,
  validateBoolean,
  validateUrl,
  validateEnum,
  validateJSON,
} from '@/lib/validation';
import type { Card, CardSize, GradientStyle } from '@/lib/types';
import { cleanupCardIcon } from '@/lib/services/assetCleanup';

/**
 * GET /api/cards/[id]
 * Get a single card (admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    await requireAuth();

    const { id } = await params;
    const cardId = validateInteger(id, 'id', 1);

    const db = getDb();

    // Get card
    const card = db
      .prepare('SELECT * FROM cards WHERE id = ?')
      .get(cardId) as Card | undefined;

    if (!card) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: card,
    });
  } catch (error: any) {
    if (error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (error.message && error.message.includes('must be')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.error('Card GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch card' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/cards/[id]
 * Update a card (admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    await requireAuth();

    const { id } = await params;
    const cardId = validateInteger(id, 'id', 1);
    const body = await request.json();

    // Validate at least one field is provided
    const hasFields =
      body.name !== undefined ||
      body.subtext !== undefined ||
      body.url !== undefined ||
      body.subcategory_id !== undefined ||
      body.icon_url !== undefined ||
      body.gradient_colors !== undefined ||
      body.gradient_style !== undefined ||
      body.size !== undefined ||
      body.show_status !== undefined ||
      body.order_index !== undefined;

    if (!hasFields) {
      return NextResponse.json(
        { error: 'At least one field must be provided' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check if card exists
    const existing = db
      .prepare('SELECT id FROM cards WHERE id = ?')
      .get(cardId) as { id: number } | undefined;

    if (!existing) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (body.subcategory_id !== undefined) {
      const subcategoryId = validateInteger(body.subcategory_id, 'subcategory_id', 1);

      // Verify subcategory exists
      const subcategory = db
        .prepare('SELECT id FROM subcategories WHERE id = ?')
        .get(subcategoryId) as { id: number } | undefined;

      if (!subcategory) {
        return NextResponse.json(
          { error: 'Subcategory not found' },
          { status: 400 }
        );
      }

      updates.push('subcategory_id = ?');
      values.push(subcategoryId);
    }

    if (body.name !== undefined) {
      const name = validateString(body.name, 'name', 1, 100);
      updates.push('name = ?');
      values.push(name);
    }

    if (body.subtext !== undefined) {
      const subtext = validateString(body.subtext, 'subtext', 1, 200);
      updates.push('subtext = ?');
      values.push(subtext);
    }

    if (body.url !== undefined) {
      const url = validateUrl(body.url, 'url');
      updates.push('url = ?');
      values.push(url);
    }

    if (body.icon_url !== undefined) {
      const iconUrl = body.icon_url !== null
        ? validateString(body.icon_url, 'icon_url', 1, 500)
        : null;
      updates.push('icon_url = ?');
      values.push(iconUrl);
    }

    if (body.gradient_colors !== undefined) {
      const gradientColors = body.gradient_colors !== null
        ? validateJSON(body.gradient_colors, 'gradient_colors')
        : null;
      updates.push('gradient_colors = ?');
      values.push(gradientColors);
    }

    if (body.gradient_style !== undefined) {
      const gradientStyle = validateEnum<GradientStyle>(body.gradient_style, 'gradient_style', ['diagonal', 'four-corner', 'radial', 'conic', 'horizontal', 'vertical', 'double-diagonal']);
      updates.push('gradient_style = ?');
      values.push(gradientStyle);
    }

    if (body.size !== undefined) {
      const size = validateEnum<CardSize>(body.size, 'size', ['small', 'medium', 'large']);
      updates.push('size = ?');
      values.push(size);
    }

    if (body.show_status !== undefined) {
      const showStatus = validateBoolean(body.show_status);
      updates.push('show_status = ?');
      values.push(showStatus ? 1 : 0);
    }

    if (body.order_index !== undefined && body.order_index !== null) {
      const orderIndex = validateInteger(body.order_index, 'order_index', 0);
      updates.push('order_index = ?');
      values.push(orderIndex);
    }

    // Always update updated_at
    updates.push("updated_at = datetime('now')");

    // Execute update
    values.push(cardId);
    db.prepare(`UPDATE cards SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    // Fetch updated card
    const card = db
      .prepare('SELECT * FROM cards WHERE id = ?')
      .get(cardId) as Card;

    return NextResponse.json({
      success: true,
      data: card,
    });
  } catch (error: any) {
    if (error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (error.message && error.message.includes('must be')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.error('Card PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update card' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cards/[id]
 * Delete a card (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    await requireAuth();

    const { id } = await params;
    const cardId = validateInteger(id, 'id', 1);

    const db = getDb();

    // Get card before deletion (need icon_url for cleanup)
    const existing = db
      .prepare('SELECT id, icon_url FROM cards WHERE id = ?')
      .get(cardId) as { id: number; icon_url: string | null } | undefined;

    if (!existing) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }

    // Delete card
    db.prepare('DELETE FROM cards WHERE id = ?').run(cardId);

    // Clean up icon if no longer in use
    cleanupCardIcon(existing.icon_url);

    return NextResponse.json({
      success: true,
      message: 'Card deleted successfully',
    });
  } catch (error: any) {
    if (error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (error.message && error.message.includes('must be')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.error('Card DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete card' },
      { status: 500 }
    );
  }
}
