import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { getDb } from '@/lib/db';
import { requireAuth, requireSuperuser } from '@/lib/auth';
import { validateString, validateEnum } from '@/lib/validation';

/**
 * GET /api/users
 * List all users (admin-only)
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication (any admin can list users)
    await requireAuth();

    const db = getDb();

    // Get all users (excluding password hash for security)
    const users = db
      .prepare(
        `SELECT
          id,
          username,
          role,
          created_at
        FROM users
        ORDER BY created_at ASC`
      )
      .all();

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

/**
 * POST /api/users
 * Create new admin account (superuser-only)
 */
export async function POST(request: NextRequest) {
  try {
    // Only superuser can create new admin accounts
    const session = await requireSuperuser();

    const body = await request.json();
    const { username, password, role } = body;

    // Validation
    const usernameError = validateString(username, 'Username', 3, 50);
    if (usernameError) {
      return NextResponse.json({ error: usernameError }, { status: 400 });
    }

    const passwordError = validateString(password, 'Password', 8, 128);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    // Validate role
    if (!role || !['superuser', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Role must be either "superuser" or "admin"' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check if username already exists
    const existingUser = db
      .prepare('SELECT id FROM users WHERE username = ?')
      .get(username);

    if (existingUser) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hash(password, 12);

    // Create user
    const result = db
      .prepare(
        'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
      )
      .run(username, passwordHash, role);

    // Return created user (without password hash)
    const newUser = db
      .prepare(
        'SELECT id, username, role, created_at FROM users WHERE id = ?'
      )
      .get(result.lastInsertRowid);

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);

    if (error instanceof Error) {
      if (error.message === 'Authentication required') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      if (error.message === 'Superuser access required') {
        return NextResponse.json(
          { error: 'Only superuser can create admin accounts' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
