import prisma from '@/lib/prisma'
import { requireCustomerAuth } from '@/lib/customerAuth'

export async function GET() {
  const student = await requireCustomerAuth()
  if (student instanceof Response) return student

  try {
    const logs = await prisma.log.findMany({
      where: { studentId: student.id },
      orderBy: { checkInTime: 'desc' },
      take: 50,
      select: {
        id: true,
        date: true,
        checkInTime: true,
        checkOutTime: true,
        method: true,
      },
    })

    return Response.json({ logs })
  } catch (e) {
    console.error('[GET /api/customer/history]', e)
    return Response.json({ error: 'Failed to fetch history' }, { status: 500 })
  }
}
