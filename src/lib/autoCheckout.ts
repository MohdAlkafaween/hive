import prisma from '@/lib/prisma'
import { todayString } from '@/lib/subscriptionLogic'

export async function autoCheckoutAll(): Promise<number> {
  const today = todayString()

  const setting = await prisma.appSetting.findUnique({ where: { key: 'autoCheckoutTime' } })
  const autoTime = setting?.value || '23:59'

  const staleLogs = await prisma.log.findMany({
    where: {
      checkOutTime: null,
      date: { not: today },
    },
  })

  let count = 0
  for (const log of staleLogs) {
    const [h, m] = autoTime.split(':').map(Number)
    const checkOutTime = new Date(`${log.date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`)
    await prisma.log.update({
      where: { id: log.id },
      data: { checkOutTime, method: 'AUTO_CHECKOUT' },
    })
    count++
  }

  const todayLogs = await prisma.log.findMany({
    where: {
      checkOutTime: null,
      date: today,
    },
  })

  for (const log of todayLogs) {
    await prisma.log.update({
      where: { id: log.id },
      data: { checkOutTime: new Date(), method: 'AUTO_CHECKOUT' },
    })
    count++
  }

  return count
}

export async function cleanupStaleSessions(): Promise<number> {
  const today = todayString()

  const staleLogs = await prisma.log.findMany({
    where: {
      checkOutTime: null,
      date: { not: today },
    },
  })

  let count = 0
  for (const log of staleLogs) {
    const checkOutTime = new Date(`${log.date}T23:59:00`)
    await prisma.log.update({
      where: { id: log.id },
      data: { checkOutTime, method: 'AUTO_CHECKOUT' },
    })
    count++
  }

  return count
}
