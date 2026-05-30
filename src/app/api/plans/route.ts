import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { sanitizeString } from '@/lib/sanitize'

export async function GET() {
  try {
    const session = await requireAuth('ADMIN', 'STAFF')
    if (session instanceof Response) return session

    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { sortOrder: 'asc' },
    })
    return Response.json(plans)
  } catch (e) {
    console.error('[GET /api/plans]', e)
    return Response.json({ error: 'Failed to fetch plans' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 })

    const name = sanitizeString(body.name)
    if (!name) return Response.json({ error: 'Name is required' }, { status: 400 })

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name,
        nameAr: body.nameAr ? sanitizeString(body.nameAr) : null,
        durationDays: Number(body.durationDays) || 30,
        totalVisits: Number(body.totalVisits) || 30,
        price: Number(body.price) || 0,
        sortOrder: Number(body.sortOrder) || 0,
        isActive: body.isActive !== false,
      },
    })

    return Response.json(plan, { status: 201 })
  } catch (e) {
    console.error('[POST /api/plans]', e)
    return Response.json({ error: 'Failed to create plan' }, { status: 500 })
  }
}
