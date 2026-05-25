import { verifyAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { auditLog } from '@/lib/auditLog'

/**
 * Server-side auth guard with live DB role verification.
 *
 * DO NOT import this file in middleware or any Edge Runtime context.
 * It imports Prisma which requires Node.js runtime.
 *
 * For Edge-safe auth (middleware), use verifyAuth() from '@/lib/auth'.
 */
export async function requireAuth(...allowedRoles: string[]): Promise<Record<string, unknown> | Response> {
  const session = await verifyAuth()

  if (!session) {
    auditLog('AUTH_FAILED', { details: 'No valid session' })
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Live DB role check — never trust the JWT role claim alone
  const user = await prisma.user.findUnique({
    where: { id: session.userId as number },
    select: { role: true },
  })

  if (!user) {
    auditLog('AUTH_FAILED', {
      userId: session.userId as number,
      details: 'User no longer exists in DB',
    })
    return new Response(
      JSON.stringify({ error: 'User no longer exists' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Override JWT role with live DB role
  session.role = user.role

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    auditLog('AUTH_FORBIDDEN', {
      userId: session.userId as number,
      details: `Role ${user.role} not in [${allowedRoles.join(', ')}]`,
    })
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return session
}
