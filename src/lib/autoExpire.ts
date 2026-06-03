import prisma from '@/lib/prisma'

// TIMEZONE: All date calculations depend on the server's system timezone.
// Ensure TZ=Asia/Amman (or your business timezone) is set in .env.
// See README.md for deployment details.

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
