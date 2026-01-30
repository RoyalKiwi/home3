import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSuperuser } from '@/lib/auth';
import { validateInteger } from '@/lib/validation';

/**
 * DELETE /api/users/[id]
 * Delete a user (superuser-only, cannot delete self or last superuser)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Only superuser can delete users
    const session = await requireSuperuser();

    const { id } = await params;
    const userId = parseInt(id, 10);

    // Validate ID - throws error if invalid
    validateInteger(userId, 'User ID', 1);

    // Prevent deleting yourself
    if (userId === session.userId) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 403 }
      );
    }

    const db = getDb();

    // Check if user exists and get their role
    const user = db
      .prepare('SELECT id, role FROM users WHERE id = ?')
      .get(userId) as { id: number; role: string } | undefined;

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent deleting the last superuser
    if (user.role === 'superuser') {
      const superuserCount = db
        .prepare("SELECT COUNT(*) as count FROM users WHERE role = 'superuser'")
        .get() as { count: number };

      if (superuserCount.count <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the last superuser account' },
          { status: 403 }
        );
      }
    }

    // Delete the user
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting user:', error);

    if (error instanceof Error) {
      // Validation errors
      if (error.message.includes('must be')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // Auth errors
      if (error.message === 'Authentication required') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      if (error.message === 'Superuser access required') {
        return NextResponse.json(
          { error: 'Only superuser can delete users' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
