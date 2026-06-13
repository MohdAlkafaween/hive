import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { sanitizeString, sanitizePhone, sanitizeRfid, isValidId } from '@/lib/sanitize'
import { checkStaffRateLimit } from '@/lib/rateLimit'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'STAFF')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'read')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const { id } = await ctx.params
    if (!isValidId(id)) return Response.json({ error: 'Invalid student ID' }, { status: 400 })

    // Note: `password` is globally omitted by the Prisma client (see src/lib/prisma.ts).
    // qrToken/rfidUuid stay — the staff profile view manages RFID cards and shows the QR code.
    const student = await prisma.student.findUnique({
      where: { id: Number(id) },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          include: { createdByUser: { select: { name: true, email: true } } },
        },
        logs: { orderBy: { checkInTime: 'desc' }, take: 30 },
        transactions: { orderBy: { createdAt: 'desc' }, take: 30 },
      },
    })
    if (!student) return Response.json({ error: 'Not found' }, { status: 404 })

    // The profile view shows a "password set" indicator — send a boolean, never the hash
    const pw = await prisma.student.findUnique({
      where: { id: Number(id) },
      select: { password: true },
    })
    return Response.json({ ...student, hasPassword: !!pw?.password })
  } catch (e) {
    console.error('[GET /api/students/[id]]', e)
    return Response.json({ error: 'Failed to fetch student' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'STAFF')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'write')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const { id } = await ctx.params
    if (!isValidId(id)) return Response.json({ error: 'Invalid student ID' }, { status: 400 })

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    // FIX #9: Whitelist only allowed fields — reject everything else
    const data: Record<string, unknown> = {}
    if (body.fullName !== undefined) {
      const name = sanitizeString(body.fullName)
      if (name.length < 2) return Response.json({ error: 'Name must be at least 2 characters' }, { status: 400 })
      data.fullName = name
    }
    if (body.phone !== undefined) {
      const phone = sanitizePhone(body.phone)
      if (phone.length < 7) return Response.json({ error: 'Invalid phone number' }, { status: 400 })
      data.phone = phone
    }
    if (body.major !== undefined) data.major = body.major ? sanitizeString(body.major) : null
    if (body.rfidUuid !== undefined) data.rfidUuid = sanitizeRfid(body.rfidUuid)
    if (body.email !== undefined) data.email = body.email ? sanitizeString(body.email) : null
    if (body.university !== undefined) data.university = body.university ? sanitizeString(body.university) : null
    if (body.gender !== undefined) data.gender = body.gender && ['male', 'female'].includes(body.gender) ? body.gender : null
    if (body.emergencyContact !== undefined) data.emergencyContact = body.emergencyContact ? sanitizeString(body.emergencyContact) : null
    if (body.emergencyPhone !== undefined) data.emergencyPhone = body.emergencyPhone ? sanitizeString(body.emergencyPhone) : null
    if (body.referralSource !== undefined) data.referralSource = body.referralSource ? sanitizeString(body.referralSource) : null
    if (body.status !== undefined && ['ACTIVE', 'SUSPENDED', 'BANNED', 'GRADUATED'].includes(body.status)) data.status = body.status
    // isLoginEnabled — only ADMIN and MANAGER can change this
    if (body.isLoginEnabled !== undefined && typeof body.isLoginEnabled === 'boolean') {
      const role = (session as Record<string, unknown>).role as string
      if (role === 'ADMIN' || role === 'MANAGER') {
        data.isLoginEnabled = body.isLoginEnabled
      }
    }
    if (body.dateOfBirth !== undefined) {
      const dob = body.dateOfBirth ? new Date(body.dateOfBirth) : null
      data.dateOfBirth = dob && !isNaN(dob.getTime()) ? dob : null
    }

    if (Object.keys(data).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const student = await prisma.student.update({
      where: { id: Number(id) },
      data,
    })
    return Response.json(student)
  } catch (e) {
    console.error('[PATCH /api/students/[id]]', e)
    const code = e instanceof Error && 'code' in e ? (e as { code: string }).code : undefined
    if (code === 'P2002') return Response.json({ error: 'Phone or RFID already in use' }, { status: 409 })
    if (code === 'P2025') return Response.json({ error: 'Student not found' }, { status: 404 })
    return Response.json({ error: 'Failed to update student' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    // Only ADMIN can delete students
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'write')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const { id } = await ctx.params
    if (!isValidId(id)) return Response.json({ error: 'Invalid student ID' }, { status: 400 })

    const numId = Number(id)

    // Delete student — logs, transactions, subscriptions, promo usages are preserved
    // (onDelete: SetNull nullifies studentId but keeps the records with denormalized studentName)
    await prisma.student.delete({ where: { id: numId } })

    return Response.json({ ok: true })
  } catch (e) {
    console.error('[DELETE /api/students/[id]]', e)
    if (e instanceof Error && 'code' in e && (e as { code: string }).code === 'P2025') return Response.json({ error: 'Student not found' }, { status: 404 })
    return Response.json({ error: 'Failed to delete student' }, { status: 500 })
  }
}
