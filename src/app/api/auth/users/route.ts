import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'

// GET all users (ADMIN only) — for admin panel
// Includes last login time and total login count from audit logs
export async function GET() {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER')
    if (session instanceof Response) return session

    const users = await prisma.user.findMany({
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
          where: { event: 'LOGIN' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
        _count: {
          select: {
            auditLogs: { where: { event: 'LOGIN' } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Flatten the response
    const result = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone,
      role: u.role,
      permissions: u.permissions,
      isActive: u.isActive,
      createdAt: u.createdAt,
      createdBy: u.createdBy,
      lastLogin: u.auditLogs[0]?.createdAt || null,
      totalLogins: u._count.auditLogs,
    }))

    return Response.json(result)
  } catch (e) {
    console.error('[GET /api/auth/users]', e)
    return Response.json({ error: 'Failed to load users' }, { status: 500 })
  }
}
