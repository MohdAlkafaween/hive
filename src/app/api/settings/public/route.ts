import prisma from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

// Public settings endpoint — returns only non-sensitive settings
// Used by kiosk pages to check if kiosk mode is enabled
export async function GET(req: Request) {
  try {
    const ip = getClientIp(req)
    const limit = checkRateLimit(`settings-public:${ip}`, 60, 60 * 1000)
    if (limit.limited) return Response.json({ error: 'Too many requests' }, { status: 429 })

    const settings = await prisma.appSetting.findMany({
      where: { key: { in: ['kioskEnabled', 'publicDisplayEnabled', 'feedbackEnabled'] } },
    })
    const map: Record<string, string> = {}
    for (const s of settings) map[s.key] = s.value
    return Response.json(map)
  } catch (e) {
    console.error('[GET /api/settings/public]', e)
    return Response.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}
