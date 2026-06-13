import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'
import { getClientIp } from '@/lib/rateLimit'

/**
 * GET /api/auth/users/[id]
 * Admin-only: get a single staff member's full details + audit log history
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER')
    if (session instanceof Response) return session

    const { id } = await params
    if (!isValidId(id)) {
      return Response.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(id) },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        permissions: true,
        isActive: true,
        createdAt: true,
        createdBy: {
          select: { id: true, email: true, name: true },
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: {
            id: true,
            event: true,
            ip: true,
            details: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            auditLogs: { where: { event: 'LOGIN' } },
          },
        },
      },
    })

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    // Compute attendance: unique login days per month
    const loginLogs = await prisma.staffAuditLog.findMany({
      where: { userId: Number(id), event: 'LOGIN' },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    })

    // Group by YYYY-MM → Set of day numbers
    const attendanceMap: Record<string, number[]> = {}
    for (const log of loginLogs) {
      const d = new Date(log.createdAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!attendanceMap[key]) attendanceMap[key] = []
      const day = d.getDate()
      if (!attendanceMap[key].includes(day)) {
        attendanceMap[key].push(day)
      }
    }

    // Convert to array sorted by month
    const attendance = Object.entries(attendanceMap)
      .map(([month, days]) => ({ month, days: days.sort((a, b) => a - b), count: days.length }))
      .sort((a, b) => b.month.localeCompare(a.month))

    const lastLogin = user.auditLogs.find((l) => l.event === 'LOGIN')?.createdAt || null

    return Response.json({
      ...user,
      totalLogins: user._count.auditLogs,
      lastLogin,
      attendance,
    })
  } catch (e) {
    console.error('[GET /api/auth/users/[id]]', e)
    return Response.json({ error: 'Failed to load user' }, { status: 500 })
  }
}

/**
 * PUT /api/auth/users/[id]
 * Admin-only: update staff member's name, phone, or isActive status
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const { id } = await params
    if (!isValidId(id)) {
      return Response.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    const user = await prisma.user.findUnique({ where: { id: Number(id) } })
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    // Build update data — only allow name, phone, isActive, role, permissions
    const updateData: Record<string, unknown> = {}
    if (typeof body.name === 'string') updateData.name = body.name.trim().slice(0, 100)
    if (typeof body.phone === 'string') updateData.phone = body.phone.trim().slice(0, 20)
    if (typeof body.isActive === 'boolean') {
      // Cannot deactivate yourself
      if (user.id === (session.userId as number) && !body.isActive) {
        return Response.json({ error: 'Cannot deactivate your own account' }, { status: 400 })
      }
      updateData.isActive = body.isActive
    }

    // Allow role changes (ADMIN only)
    const validRoles = ['ADMIN', 'MANAGER', 'STAFF', 'BARISTA']
    if (typeof body.role === 'string' && validRoles.includes(body.role) && body.role !== user.role) {
      // Prevent admin from demoting themselves
      if (user.id === (session.userId as number)) {
        return Response.json({ error: 'Cannot change your own role' }, { status: 400 })
      }
      const oldRole = user.role
      updateData.role = body.role

      // Log the role change
      const ip = getClientIp(req)
      await prisma.staffAuditLog.create({
        data: {
          userId: session.userId as number,
          email: session.email as string,
          role: session.role as string,
          event: 'ROLE_CHANGED',
          ip,
          details: `Role changed from ${oldRole} to ${body.role} for user ${user.email}`,
        },
      }).catch(() => {})
    }

    // Allow updating permissions for MANAGER role
    const targetRole = (updateData.role as string) || user.role
    if (Array.isArray(body.permissions) && targetRole === 'MANAGER') {
      const validPages = ['/', '/directory', '/logs', '/stats', '/barista', '/orders', '/feedback', '/admin']
      const filtered = body.permissions.filter((p: string) => validPages.includes(p))
      updateData.permissions = JSON.stringify(filtered)
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id: Number(id) },
      data: updateData,
      select: { id: true, email: true, name: true, phone: true, role: true, isActive: true },
    })

    return Response.json(updated)
  } catch (e) {
    console.error('[PUT /api/auth/users/[id]]', e)
    return Response.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

/**
 * DELETE /api/auth/users/[id]
 * Admin-only: permanently delete a staff account (audit logs are preserved)
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const { id } = await params
    if (!isValidId(id)) {
      return Response.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const userId = Number(id)

    // Cannot delete yourself
    if (userId === (session.userId as number)) {
      return Response.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    // Cannot delete another ADMIN
    if (user.role === 'ADMIN') {
      return Response.json({ error: 'Cannot delete admin accounts' }, { status: 400 })
    }

    // Log the deletion
    const ip = getClientIp(req)
    await prisma.staffAuditLog.create({
      data: {
        userId: session.userId as number,
        email: session.email as string,
        role: session.role as string,
        event: 'STAFF_DELETED',
        ip,
        details: `Deleted staff: ${user.email} (${user.role})`,
      },
    })

    // Delete user — audit logs are preserved (onDelete: SetNull nullifies userId)
    await prisma.user.delete({ where: { id: userId } })

    return Response.json({ message: `Account ${user.email} deleted` })
  } catch (e) {
    console.error('[DELETE /api/auth/users/[id]]', e)
    return Response.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
