import prisma from '@/lib/prisma'

export async function getCapacityInfo() {
  const setting = await prisma.appSetting.findUnique({ where: { key: 'maxCapacity' } })
  const maxCapacity = setting ? Number(setting.value) : 0 // 0 = unlimited

  if (maxCapacity <= 0) return { maxCapacity: 0, currentOccupancy: 0, isFull: false }

  // Count students currently inside (open logs with no checkout).
  // autoCheckoutExpired() closes stale logs, so any remaining open log = currently inside.
  const currentOccupancy = await prisma.log.count({
    where: { checkOutTime: null },
  })

  return { maxCapacity, currentOccupancy, isFull: currentOccupancy >= maxCapacity }
}
