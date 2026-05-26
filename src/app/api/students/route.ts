import { NextRequest } from 'next/server'
import { randomBytes } from 'crypto'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { sanitizeString, sanitizePhone, sanitizeRfid } from '@/lib/sanitize'

export async function GET() {
  try {
    const session = await requireAuth('ADMIN', 'REGISTERATION_COUNTER')
    if (session instanceof Response) return session

    const students = await prisma.student.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        subscriptions: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })
    return Response.json(students)
  } catch (e) {
    console.error('[GET /api/students]', e)
    return Response.json({ error: 'Failed to fetch students' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN', 'REGISTERATION_COUNTER')
    if (session instanceof Response) return session

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    const fullName = sanitizeString(body.fullName)
    const phone = sanitizePhone(body.phone)
    const major = body.major ? sanitizeString(body.major) : null
    const rfidUuid = sanitizeRfid(body.rfidUuid)

    if (!fullName || fullName.length < 2) return Response.json({ error: 'Valid name required (min 2 chars)' }, { status: 400 })
    if (!phone || phone.length < 7) return Response.json({ error: 'Valid phone required (min 7 digits)' }, { status: 400 })

    const qrToken = randomBytes(16).toString('hex')
    const student = await prisma.student.create({
      data: { fullName, phone, major, rfidUuid, qrToken },
    })
    return Response.json(student, { status: 201 })
  } catch (e: any) {
    console.error('[POST /api/students]', e)
    if (e?.code === 'P2002') {
      return Response.json({ error: 'Phone number or RFID already in use' }, { status: 409 })
    }
    return Response.json({ error: 'Failed to create student' }, { status: 500 })
  }
}
