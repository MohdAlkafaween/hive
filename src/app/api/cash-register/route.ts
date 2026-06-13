import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { todayString } from '@/lib/subscriptionLogic'
import { checkStaffRateLimit } from '@/lib/rateLimit'

export async function GET() {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'STAFF')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'read')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const registers = await prisma.cashRegister.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return Response.json(registers)
  } catch {
    return Response.json({ error: 'Failed to load registers' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'STAFF')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'write')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const body = await req.json().catch(() => null)
    if (typeof body?.openingCash !== 'number') {
      return Response.json({ error: 'Opening cash amount required' }, { status: 400 })
    }

    // Check for existing open register for this user
    const existing = await prisma.cashRegister.findFirst({
      where: { userId: session.userId as number, status: 'OPEN' },
    })
    if (existing) {
      return Response.json({ error: 'You already have an open register. Close it first.' }, { status: 400 })
    }

    // Find current shift
    const today = todayString()
    const shift = await prisma.staffShift.findFirst({
      where: { userId: session.userId as number, date: today, clockOut: null },
    })

    const register = await prisma.cashRegister.create({
      data: {
        userId: session.userId as number,
        userName: (session.email as string).split('@')[0],
        shiftId: shift?.id || null,
        openingCash: body.openingCash,
      },
    })
    return Response.json(register, { status: 201 })
  } catch {
    return Response.json({ error: 'Failed to open register' }, { status: 500 })
  }
}
