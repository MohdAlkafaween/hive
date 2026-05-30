import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { sanitizeString } from '@/lib/sanitize'

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN', 'STAFF')
    if (session instanceof Response) return session

    const rawQ = req.nextUrl.searchParams.get('q') ?? ''
    const q = sanitizeString(rawQ)
    if (!q || q.length < 2) return Response.json([])

    // Also search by student number
    const numQ = parseInt(q)
    const orConditions: Record<string, unknown>[] = [
      { fullName: { contains: q } },
      { phone:    { contains: q } },
    ]
    if (!isNaN(numQ)) {
      orConditions.push({ studentNumber: numQ })
    }

    const students = await prisma.student.findMany({
      where: { OR: orConditions },
      take: 10,
      include: {
        subscriptions: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })
    return Response.json(students)
  } catch (e) {
    console.error('[GET /api/students/search]', e)
    return Response.json({ error: 'Search failed' }, { status: 500 })
  }
}
