import prisma from '@/lib/prisma'
import { todayString } from '@/lib/subscriptionLogic'

export async function getCapacityInfo() {
  const setting = await prisma.appSetting.findUnique({ where: { key: 'maxCapacity' } })
  const maxCapacity = setting ? Number(setting.value) : 0 // 0 = unlimited

  if (maxCapacity <= 0) return { maxCapacity: 0, currentOccupancy: 0, isFull: false }

  const today = todayString()
  const currentOccupancy = await prisma.log.count({
    where: { date: today, checkOutTime: null },
  })

  return { maxCapacity, currentOccupancy, isFull: currentOccupancy >= maxCapacity }
}
