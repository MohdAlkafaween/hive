import prisma from '@/lib/prisma'
import { sanitizeRfid } from '@/lib/sanitize'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { verifyAuth } from '@/lib/auth'

// RFID lookup is public (kiosk) but rate-limited
// Returns minimal data for public access; full details for authenticated staff
export async function GET(req: Request, ctx: { params: Promise<{ uuid: string }> }) {
  try {
    const ip = getClientIp(req)
    const limit = checkRateLimit(`rfid:${ip}`, 30, 60 * 1000)
    if (limit.limited) {
      return Response.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { uuid } = await ctx.params
    const cleanUuid = sanitizeRfid(uuid)
    if (!cleanUuid) return Response.json({ error: 'Invalid RFID' }, { status: 400 })

    // SECURITY (D1): even the authenticated branch never needs credentials/PII extras
    const student = await prisma.student.findUnique({
      where: { rfidUuid: cleanUuid },
      select: {
        id: true,
        studentNumber: true,
        fullName: true,
        phone: true,
        status: true,
        photoUrl: true,
        lifetimeCheckIns: true,
        subscriptions: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })
    if (!student) return Response.json({ error: 'No student linked to this RFID' }, { status: 404 })

    // Check if caller is authenticated staff — if so, return full details
    const session = await verifyAuth()
    if (session) {
      return Response.json(student)
    }

    // Public access: return minimal data only — no PII exposure
    const sub = student.subscriptions[0] ?? null
    const firstName = student.fullName.split(' ')[0]
    return Response.json({
      id: student.id,
      firstName,
      photoUrl: student.photoUrl,
      subscriptionActive: !!sub,
      status: sub ? 'active' : 'no_subscription',
    })
  } catch (e) {
    console.error('[GET /api/rfid/[uuid]]', e)
    return Response.json({ error: 'RFID lookup failed' }, { status: 500 })
  }
}
