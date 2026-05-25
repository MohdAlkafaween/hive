import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

// Edge-safe auth utilities — NO Node.js imports allowed here.
// This file is imported by middleware (Edge Runtime).
// For API route auth with DB checks, use requireAuth from '@/lib/authGuard'

const secretKey = process.env.JWT_SECRET || 'super-secret-key-for-hive-study'
if (process.env.NODE_ENV === 'production' && secretKey === 'super-secret-key-for-hive-study') {
  throw new Error('FATAL: Set JWT_SECRET environment variable in production. Do not use the default.')
}
const key = new TextEncoder().encode(secretKey)

export async function encrypt(payload: Record<string, unknown>) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
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
  const session = (await cookies()).get('session')?.value
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
