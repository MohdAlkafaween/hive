import { requireCustomerAuth } from '@/lib/customerAuth'
import prisma from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rateLimit'
import { sanitizeString } from '@/lib/sanitize'

// POST — customer submits feedback/ratings for completed order items
export async function POST(req: Request) {
  const customer = await requireCustomerAuth()
  if (customer instanceof Response) return customer

  const limit = checkRateLimit(`customer-feedback:${customer.id}`, 30, 60 * 60 * 1000)
  if (limit.limited) {
    return Response.json({ error: 'Too many submissions. Try again later.' }, { status: 429 })
  }

  try {
    // Check if feedback is enabled
    const setting = await prisma.appSetting.findUnique({ where: { key: 'feedbackEnabled' } })
    if (setting?.value !== 'true') {
      return Response.json({ error: 'Feedback is disabled' }, { status: 403 })
    }

    const body = await req.json()
    const { ratings } = body as { ratings: { baristaOrderId: number; menuItemId: number; rating: number; comment?: string }[] }

    if (!Array.isArray(ratings) || ratings.length === 0) {
      return Response.json({ error: 'ratings array is required' }, { status: 400 })
    }

    // Validate each rating
    for (const r of ratings) {
      if (!r.baristaOrderId || !r.menuItemId || !r.rating || r.rating < 1 || r.rating > 5) {
        return Response.json({ error: 'Invalid rating data' }, { status: 400 })
      }
    }

    // Verify the orders belong to this customer and are COMPLETED
    const orderIds = ratings.map(r => r.baristaOrderId)
    const orders = await prisma.baristaOrder.findMany({
      where: { id: { in: orderIds }, studentId: customer.id, status: 'COMPLETED' },
      select: { id: true },
    })
    const validIds = new Set(orders.map(o => o.id))

    // Check for duplicate feedback
    const existingFeedback = await prisma.itemFeedback.findMany({
      where: { baristaOrderId: { in: orderIds }, studentId: customer.id },
      select: { baristaOrderId: true },
    })
    const alreadyRated = new Set(existingFeedback.map(f => f.baristaOrderId))

    const toCreate = ratings
      .filter(r => validIds.has(r.baristaOrderId) && !alreadyRated.has(r.baristaOrderId))
      .map(r => ({
        baristaOrderId: r.baristaOrderId,
        menuItemId: r.menuItemId,
        studentId: customer.id,
        rating: r.rating,
        comment: r.comment ? sanitizeString(r.comment) || null : null,
      }))

    if (toCreate.length === 0) {
      return Response.json({ message: 'No new feedback to submit' })
    }

    await prisma.itemFeedback.createMany({ data: toCreate })

    return Response.json({ message: 'Feedback submitted', count: toCreate.length })
  } catch (e) {
    console.error('[POST /api/customer/feedback]', e)
    return Response.json({ error: 'Failed to submit feedback' }, { status: 500 })
  }
}
