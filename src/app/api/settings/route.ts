import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { sanitizeString } from '@/lib/sanitize'

// GET all settings
export async function GET() {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'STAFF')
    if (session instanceof Response) return session

    const settings = await prisma.appSetting.findMany()
    const map: Record<string, string> = {}
    for (const s of settings) map[s.key] = s.value
    return Response.json(map)
  } catch (e) {
    console.error('[GET /api/settings]', e)
    return Response.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

// Whitelist of allowed setting keys to prevent arbitrary data injection
const ALLOWED_KEYS = new Set([
  'maxCapacity',
  'displayEnabled',
  'displayConnection',
  'nextReceiptNumber',
  'nextStudentNumber',
  'maxFreezeDays',
  'houseName',
  'houseNameAr',
  'defaultPlan',
  'businessName',
  'receiptFooter',
  'autoCheckoutTime',
  'maxSessionHours',
  'backupFrequencyHours',
  'backupRetentionDays',
  'announcement',
  'publicDisplayEnabled',
  'publicDisplayConnection',
  'qrEnabled',
  'planPriceDaily',
  'planPriceWeekly',
  'planPriceMonthly',
  'planVisitsDaily',
  'planVisitsWeekly',
  'planVisitsMonthly',
  'planDaysDaily',
  'planDaysWeekly',
  'planDaysMonthly',
])

// PUT — upsert a setting (ADMIN only)
export async function PUT(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 })

    const key = sanitizeString(body.key)
    const value = sanitizeString(body.value)
    if (!key || value === undefined) return Response.json({ error: 'key and value required' }, { status: 400 })

    if (!ALLOWED_KEYS.has(key)) {
      return Response.json({ error: `Unknown setting key: ${key}` }, { status: 400 })
    }

    const setting = await prisma.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    })
    return Response.json(setting)
  } catch (e) {
    console.error('[PUT /api/settings]', e)
    return Response.json({ error: 'Failed to save setting' }, { status: 500 })
  }
}
