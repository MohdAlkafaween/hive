import prisma from '@/lib/prisma'

/**
 * Auto-deactivate expired subscriptions.
 * Called on check-in and periodically by the dashboard.
 */
export async function autoExpireSubscriptions() {
  const now = new Date()
  const expired = await prisma.subscription.updateMany({
    where: {
      isActive: true,
      expiryDate: { lt: now },
    },
    data: { isActive: false },
  })
  return expired.count
}
