import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { getDb } from '@/lib/db';
import { setSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    // Validation
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Find user
    const user = db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(username) as
      | { id: number; username: string; password_hash: string; role: 'superuser' | 'admin' }
      | undefined;

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Verify password
    const passwordValid = await compare(password, user.password_hash);

    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Create session
    await setSession({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
