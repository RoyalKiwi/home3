import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_COOKIE_NAME = 'homepage3_session';
const JWT_EXPIRY = '24h'; // 24 hours

// Convert string secret to Uint8Array
const secret = new TextEncoder().encode(JWT_SECRET);

export interface JWTPayload {
  userId: number;
  username: string;
  role: 'superuser' | 'admin';
}

/**
 * Sign a JWT token with user payload
 */
export async function signToken(payload: JWTPayload): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(secret);

  return token;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JWTPayload;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Get current session from cookies (server-side only)
 */
export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(JWT_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifyToken(token);
}

/**
 * Set session cookie (server-side only)
 */
export async function setSession(payload: JWTPayload): Promise<void> {
  const token = await signToken(payload);
  const cookieStore = await cookies();

  cookieStore.set(JWT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours in seconds
    path: '/',
  });
}

/**
 * Clear session cookie (logout)
 */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(JWT_COOKIE_NAME);
}

/**
 * Check if user has required role
 */
export function hasRole(session: JWTPayload | null, requiredRole: 'superuser' | 'admin'): boolean {
  if (!session) {
    return false;
  }

  if (requiredRole === 'superuser') {
    return session.role === 'superuser';
  }

  // Admin role check - both superuser and admin qualify
  return session.role === 'superuser' || session.role === 'admin';
}

/**
 * Require authentication - throw error if not authenticated
 */
export async function requireAuth(): Promise<JWTPayload> {
  const session = await getSession();

  if (!session) {
    throw new Error('Authentication required');
  }

  return session;
}

/**
 * Require superuser role - throw error if not superuser
 */
export async function requireSuperuser(): Promise<JWTPayload> {
  const session = await requireAuth();

  if (session.role !== 'superuser') {
    throw new Error('Superuser access required');
  }

  return session;
}
