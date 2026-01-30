import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { validateString, validateInteger, validateBoolean } from '@/lib/validation';
import type { Subcategory, Card } from '@/lib/types';

/**
 * GET /api/subcategories/[id]
 * Get a single subcategory with its cards
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    await requireAuth();

    const { id } = await params;
    const subcategoryId = validateInteger(id, 'id', 1);

    const db = getDb();

    // Get subcategory
    const subcategory = db
      .prepare('SELECT * FROM subcategories WHERE id = ?')
      .get(subcategoryId) as Subcategory | undefined;

    if (!subcategory) {
      return NextResponse.json(
        { error: 'Subcategory not found' },
        { status: 404 }
      );
    }

    // Get cards
    const cards = db
      .prepare('SELECT * FROM cards WHERE subcategory_id = ? ORDER BY order_index')
      .all(subcategoryId) as Card[];

    return NextResponse.json({
      success: true,
      data: {
        ...subcategory,
        cards,
      },
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

    console.error('Subcategory GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subcategory' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/subcategories/[id]
 * Update a subcategory
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    await requireAuth();

    const { id } = await params;
    const subcategoryId = validateInteger(id, 'id', 1);
    const body = await request.json();

    // Validate at least one field is provided
    if (
      !body.name &&
      body.order_index === undefined &&
      body.category_id === undefined &&
      body.show_separator === undefined &&
      body.admin_only === undefined
    ) {
      return NextResponse.json(
        { error: 'At least one field must be provided' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check if subcategory exists
    const existing = db
      .prepare('SELECT id FROM subcategories WHERE id = ?')
      .get(subcategoryId) as { id: number } | undefined;

    if (!existing) {
      return NextResponse.json(
        { error: 'Subcategory not found' },
        { status: 404 }
      );
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (body.category_id !== undefined) {
      const categoryId = validateInteger(body.category_id, 'category_id', 1);

      // Verify category exists
      const category = db
        .prepare('SELECT id FROM categories WHERE id = ?')
        .get(categoryId) as { id: number } | undefined;

      if (!category) {
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 400 }
        );
      }

      updates.push('category_id = ?');
      values.push(categoryId);
    }

    if (body.name !== undefined) {
      const name = validateString(body.name, 'name', 1, 100);
      console.log(`📝 Updating name: "${name}" (type: ${typeof name}, length: ${name.length})`);
      updates.push('name = ?');
      values.push(name);
    }

    if (body.order_index !== undefined && body.order_index !== null) {
      const orderIndex = validateInteger(body.order_index, 'order_index', 0);
      updates.push('order_index = ?');
      values.push(orderIndex);
    }

    if (body.show_separator !== undefined) {
      const showSeparator = validateBoolean(body.show_separator);
      updates.push('show_separator = ?');
      values.push(showSeparator ? 1 : 0);
    }

    if (body.admin_only !== undefined) {
      const adminOnly = validateBoolean(body.admin_only);
      console.log(`🔒 Updating admin_only: ${adminOnly} (will save as: ${adminOnly ? 1 : 0})`);
      updates.push('admin_only = ?');
      values.push(adminOnly ? 1 : 0);
    }

    console.log(`📊 Final SQL params - updates: ${updates.join(', ')}, values:`, values);

    // Always update updated_at
    updates.push("updated_at = datetime('now')");

    // Execute update
    values.push(subcategoryId);
    db.prepare(`UPDATE subcategories SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    // Fetch updated subcategory
    const subcategory = db
      .prepare('SELECT * FROM subcategories WHERE id = ?')
      .get(subcategoryId) as Subcategory;

    console.log(`✅ Subcategory after update: name="${subcategory.name}", admin_only=${subcategory.admin_only}`);

    return NextResponse.json({
      success: true,
      data: subcategory,
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

    console.error('Subcategory PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update subcategory' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/subcategories/[id]
 * Delete a subcategory (cascades to cards)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    await requireAuth();

    const { id } = await params;
    const subcategoryId = validateInteger(id, 'id', 1);

    const db = getDb();

    // Check if subcategory exists
    const existing = db
      .prepare('SELECT id FROM subcategories WHERE id = ?')
      .get(subcategoryId) as { id: number } | undefined;

    if (!existing) {
      return NextResponse.json(
        { error: 'Subcategory not found' },
        { status: 404 }
      );
    }

    // Delete subcategory (cascade delete handled by database foreign keys)
    db.prepare('DELETE FROM subcategories WHERE id = ?').run(subcategoryId);

    return NextResponse.json({
      success: true,
      message: 'Subcategory deleted successfully',
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

    console.error('Subcategory DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete subcategory' },
      { status: 500 }
    );
  }
}
