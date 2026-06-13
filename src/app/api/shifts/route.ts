import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { todayString } from '@/lib/subscriptionLogic'
import { checkStaffRateLimit } from '@/lib/rateLimit'

// GET — list shifts (admin: all, others: own)
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'STAFF')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'read')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') || todayString()

    const userId = session.userId as number
    const role = session.role as string
    const where = role === 'ADMIN'
      ? { date }
      : { date, userId }

    const shifts = await prisma.staffShift.findMany({
      where,
      orderBy: { clockIn: 'desc' },
    })
    return Response.json(shifts)
  } catch (e) {
    console.error('[GET /api/shifts]', e)
    return Response.json({ error: 'Failed to load shifts' }, { status: 500 })
  }
}

// POST — clock in (auto-called on login)
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'STAFF')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'write')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const today = todayString()

    // Check if already clocked in today without clock-out
    const existing = await prisma.staffShift.findFirst({
      where: { userId: session.userId as number, date: today, clockOut: null },
    })
    if (existing) return Response.json({ shift: existing, alreadyClockedIn: true })

    const shift = await prisma.staffShift.create({
      data: {
        userId: session.userId as number,
        email: session.email as string,
        role: session.role as string,
        date: today,
      },
    })
    return Response.json({ shift }, { status: 201 })
  } catch (e) {
    console.error('[POST /api/shifts]', e)
    return Response.json({ error: 'Failed to clock in' }, { status: 500 })
  }
}

// PATCH — clock out
export async function PATCH() {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'STAFF')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'write')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const today = todayString()
    const openShift = await prisma.staffShift.findFirst({
      where: { userId: session.userId as number, date: today, clockOut: null },
    })
    if (!openShift) return Response.json({ error: 'No open shift found' }, { status: 404 })

    const updated = await prisma.staffShift.update({
      where: { id: openShift.id },
      data: { clockOut: new Date() },
    })
    return Response.json({ shift: updated })
  } catch (e) {
    console.error('[PATCH /api/shifts]', e)
    return Response.json({ error: 'Failed to clock out' }, { status: 500 })
  }
}
