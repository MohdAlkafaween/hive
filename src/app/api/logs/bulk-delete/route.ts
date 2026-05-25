import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidDateString } from '@/lib/sanitize'

// DELETE — admin bulk-deletes logs within a date range
export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    const { fromDate, toDate } = body
    if (!fromDate || !toDate || !isValidDateString(fromDate) || !isValidDateString(toDate)) {
      return Response.json({ error: 'Valid fromDate and toDate (YYYY-MM-DD) required' }, { status: 400 })
    }

    if (fromDate > toDate) {
      return Response.json({ error: 'fromDate must be before or equal to toDate' }, { status: 400 })
    }

    const result = await prisma.log.deleteMany({
      where: {
        date: { gte: fromDate, lte: toDate },
      },
    })

    return Response.json({ deleted: result.count })
  } catch (e) {
    console.error('[DELETE /api/logs/bulk-delete]', e)
    return Response.json({ error: 'Bulk delete failed' }, { status: 500 })
  }
}
