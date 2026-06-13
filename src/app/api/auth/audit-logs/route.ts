import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { checkStaffRateLimit } from '@/lib/rateLimit'

/**
 * GET /api/auth/audit-logs?page=1&limit=50&userId=&event=
 * Admin-only: view staff login/logout/password-reset audit trail
 *
 * Query params:
 * - page (default: 1)
 * - limit (default: 50, max: 200)
 * - userId (optional filter)
 * - event (optional filter: LOGIN, LOGOUT, PASSWORD_RESET_BY_ADMIN)
 */
export async function GET(req: Request) {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'read')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const url = new URL(req.url)
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 50))
    const userIdFilter = url.searchParams.get('userId')
    const eventFilter = url.searchParams.get('event')

    // Build where clause
    const where: Record<string, unknown> = {}
    if (userIdFilter && !isNaN(Number(userIdFilter))) {
      where.userId = Number(userIdFilter)
    }
    if (eventFilter && ['LOGIN', 'LOGOUT', 'PASSWORD_RESET_BY_ADMIN'].includes(eventFilter)) {
      where.event = eventFilter
    }

    const [logs, total] = await Promise.all([
      prisma.staffAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { id: true, email: true, role: true },
          },
        },
      }),
      prisma.staffAuditLog.count({ where }),
    ])

    return Response.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (e) {
    console.error('[GET /api/auth/audit-logs]', e)
    return Response.json({ error: 'Failed to load audit logs' }, { status: 500 })
  }
}
