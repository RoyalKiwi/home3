import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { getDb } from '@/lib/db';
import { signToken } from '@/lib/auth';

const JWT_COOKIE_NAME = 'homepage3_session';

export async function POST(request: NextRequest) {
  console.log('🔑 Login attempt received');
  try {
    const body = await request.json();
    const { username, password } = body;
    console.log('📝 Request body parsed, username:', username);

    // Validation
    if (!username || !password) {
      console.log('❌ Validation failed: missing credentials');
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    console.log('🗄️  Getting database connection');
    const db = getDb();

    // Find user
    console.log('🔍 Looking up user:', username);
    const user = db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(username) as
      | { id: number; username: string; password_hash: string; role: 'superuser' | 'admin' }
      | undefined;

    if (!user) {
      console.log('❌ User not found:', username);
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    console.log('✅ User found, verifying password...');
    // Verify password
    const passwordValid = await compare(password, user.password_hash);
    console.log('🔐 Password verification result:', passwordValid);

    if (!passwordValid) {
      console.log('❌ Invalid password for user:', username);
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    console.log('🎟️  Creating JWT token...');
    // Create JWT token
    const token = await signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });
    console.log('✅ JWT token created');

    // Create response with cookie
    console.log('📦 Creating response with cookie...');
    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });

    // Set cookie on response
    response.cookies.set(JWT_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours in seconds
      path: '/',
    });

    console.log('✅ Login successful for user:', username);
    return response;
  } catch (error) {
    console.error('💥 Login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
