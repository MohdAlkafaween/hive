import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { STAFF_COOKIE_NAME } from '@/lib/cookieConfig'

// Edge-safe auth utilities — NO Node.js imports allowed here.
// This file is imported by middleware (Edge Runtime).
// For API route auth with DB checks, use requireAuth from '@/lib/authGuard'

// Single source of truth for JWT secret resolution.
// MUST match the fallback in src/middleware.ts if duplicated there.
const DEV_ONLY_FALLBACK = 'hive-dev-only-do-not-use-in-production'
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable must be set in production. Generate with: openssl rand -base64 32')
  }
  console.warn('[auth] WARNING: JWT_SECRET not set. Using insecure default for development only.')
}
const key = new TextEncoder().encode(JWT_SECRET || DEV_ONLY_FALLBACK)

export async function encrypt(payload: Record<string, unknown>, expiresIn: string = '8h') {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key)
}

export async function decrypt(input: string): Promise<Record<string, unknown> | null> {
  try {
    const { payload } = await jwtVerify(input, key, {
      algorithms: ['HS256'],
    })
    return payload as Record<string, unknown>
  } catch {
    return null
  }
}

export async function getSession() {
  const session = (await cookies()).get(STAFF_COOKIE_NAME)?.value
  if (!session) return null
  return await decrypt(session)
}

export async function verifyAuth() {
  const session = await getSession()
  if (!session?.userId) {
    return null
  }
  return session
}
