import prisma from '@/lib/prisma'
import { sanitizeRfid } from '@/lib/sanitize'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

// RFID lookup is public (kiosk) but rate-limited
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

    const student = await prisma.student.findUnique({
      where: { rfidUuid: cleanUuid },
      include: {
        subscriptions: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })
    if (!student) return Response.json({ error: 'No student linked to this RFID' }, { status: 404 })
    return Response.json(student)
  } catch (e) {
    console.error('[GET /api/rfid/[uuid]]', e)
    return Response.json({ error: 'RFID lookup failed' }, { status: 500 })
  }
}
