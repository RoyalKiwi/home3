import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession, requireAuth } from '@/lib/auth';
import {
  validateString,
  validateInteger,
  validateBoolean,
  validateUrl,
  validateEnum,
  validateJSON,
} from '@/lib/validation';
import type { Card, CardSize, GradientStyle } from '@/lib/types';
import { fetchIconFromUrl } from '@/lib/services/branding';

/**
 * GET /api/cards
 * List all cards with role-based filtering
 * Public endpoint - filters admin-only cards for non-authenticated users
 */
export async function GET(request: NextRequest) {
  try {
    // Optional authentication - don't throw if missing
    const session = await getSession();
    const isAdmin = session?.role === 'admin' || session?.role === 'superuser';

    const { searchParams } = new URL(request.url);
    const subcategoryIdParam = searchParams.get('subcategory_id');

    const db = getDb();

    // Build query based on role
    let query = `
      SELECT c.* FROM cards c
      JOIN subcategories s ON c.subcategory_id = s.id
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    // Optional filter by subcategory_id
    if (subcategoryIdParam) {
      const subcategoryId = validateInteger(subcategoryIdParam, 'subcategory_id', 1);
      conditions.push('c.subcategory_id = ?');
      params.push(subcategoryId);
    }

    // Filter admin-only subcategories for non-admin users
    if (!isAdmin) {
      conditions.push('s.admin_only = 0');
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY c.order_index';

    const cards = db.prepare(query).all(...params) as Card[];

    return NextResponse.json({
      success: true,
      data: cards,
    });
  } catch (error: any) {
    if (error.message && error.message.includes('must be')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.error('Cards GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cards' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cards
 * Create a new card (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    await requireAuth();

    const body = await request.json();

    // Validate required fields
    const subcategoryId = validateInteger(body.subcategory_id, 'subcategory_id', 1);
    const name = validateString(body.name, 'name', 1, 100);
    const subtext = validateString(body.subtext, 'subtext', 1, 200);
    const url = validateUrl(body.url, 'url');

    const db = getDb();

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

    // Validate optional fields
    let iconUrl = body.icon_url !== undefined && body.icon_url !== null
      ? validateString(body.icon_url, 'icon_url', 1, 500)
      : null;

    let gradientColors = body.gradient_colors !== undefined && body.gradient_colors !== null
      ? validateJSON(body.gradient_colors, 'gradient_colors')
      : null;

    const gradientStyle: GradientStyle = body.gradient_style !== undefined
      ? validateEnum<GradientStyle>(body.gradient_style, 'gradient_style', ['diagonal', 'four-corner', 'radial', 'conic', 'horizontal', 'vertical', 'double-diagonal'])
      : 'diagonal';

    // Auto-fetch icon if not provided (gradient is manual via UI button)
    if (!iconUrl) {
      console.log(`🎯 Auto-fetching icon for: ${name} (${url})`);
      try {
        const fetchedIconPath = await fetchIconFromUrl(url);
        if (fetchedIconPath) {
          iconUrl = fetchedIconPath;
          console.log(`✅ Auto-fetch successful for ${name}`);
        } else {
          console.log(`⚠️  Auto-fetch failed for ${name}, card will use default icon`);
        }
      } catch (error) {
        console.error(`❌ Auto-fetch error for ${name}:`, error);
        // Continue without icon - fail gracefully
      }
    }

    const size: CardSize = body.size !== undefined
      ? validateEnum<CardSize>(body.size, 'size', ['small', 'medium', 'large'])
      : 'small';

    const showStatus = body.show_status !== undefined
      ? validateBoolean(body.show_status)
      : true;

    // Calculate order_index if not provided
    let orderIndex: number;
    if (body.order_index !== undefined && body.order_index !== null) {
      orderIndex = validateInteger(body.order_index, 'order_index', 0);
    } else {
      // Auto-calculate: get max order_index + 1 for this subcategory
      const maxOrder = db
        .prepare('SELECT MAX(order_index) as max FROM cards WHERE subcategory_id = ?')
        .get(subcategoryId) as { max: number | null };
      orderIndex = (maxOrder?.max ?? -1) + 1;
    }

    // Insert card
    const result = db
      .prepare(`
        INSERT INTO cards (
          subcategory_id, name, subtext, url, icon_url,
          gradient_colors, gradient_style, size, show_status, order_index
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        subcategoryId,
        name,
        subtext,
        url,
        iconUrl,
        gradientColors,
        gradientStyle,
        size,
        showStatus ? 1 : 0,
        orderIndex
      );

    // Fetch the created card
    const card = db
      .prepare('SELECT * FROM cards WHERE id = ?')
      .get(result.lastInsertRowid) as Card;

    return NextResponse.json(
      {
        success: true,
        data: card,
      },
      { status: 201 }
    );
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

    console.error('Cards POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create card' },
      { status: 500 }
    );
  }
}
