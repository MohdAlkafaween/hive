import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'

// POST — auto-cleanup: delete all checked-out logs from previous days
// Called at midnight from the frontend, or manually by admin
export async function POST() {
  try {
    const session = await requireAuth('ADMIN', 'REGISTERATION_COUNTER')
    if (session instanceof Response) return session

    const today = new Date().toISOString().slice(0, 10)

    // Delete all logs from previous days where the student checked out
    const result = await prisma.log.deleteMany({
      where: {
        date: { not: today },
        checkOutTime: { not: null },
      },
    })

    return Response.json({ deleted: result.count })
  } catch (e) {
    console.error('[POST /api/logs/cleanup]', e)
    return Response.json({ error: 'Cleanup failed' }, { status: 500 })
  }
}
