export type PlanType = 'Daily' | 'Weekly' | 'Monthly'

export const PLAN_DEFAULTS: Record<PlanType, { price: number; totalVisitsAllowed: number; durationDays: number }> = {
  Daily:   { price: 3,  totalVisitsAllowed: -1,  durationDays: 1  },
  Weekly:  { price: 15, totalVisitsAllowed: 7,   durationDays: 10 },
  Monthly: { price: 50, totalVisitsAllowed: 30,  durationDays: 40 },
}

export function computeExpiryDate(planType: PlanType, startDate: Date): Date {
  const d = new Date(startDate)
  if (planType === 'Daily') {
    d.setHours(23, 59, 59, 999)
    return d
  }
  d.setDate(d.getDate() + PLAN_DEFAULTS[planType].durationDays)
  d.setHours(23, 59, 59, 999)
  return d
}

/**
 * Returns today's date as YYYY-MM-DD in the server's local timezone.
 * Using toISOString() would return UTC which causes midnight rollover issues
 * (e.g. 11pm local = next day in UTC).
 *
 * TODO: Timezone — this uses the server's system timezone (Date methods use local TZ).
 * If the server is in UTC but the business operates in UTC+3 (Jordan), dates between
 * midnight and 3 AM local time will be off by one day. Configure the server's TZ
 * to match the business location (e.g., TZ=Asia/Amman) or implement explicit timezone handling.
 */
export function todayString(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function toLocalDateString(date: Date | string): string {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function isSubscriptionActive(sub: {
  isActive: boolean
  expiryDate: Date
  visitsUsed: number
  totalVisitsAllowed: number
  planType: string
}): { active: boolean; reason?: string } {
  if (!sub.isActive) return { active: false, reason: 'Subscription is no longer active.' }
  if (new Date() > new Date(sub.expiryDate)) return { active: false, reason: 'Subscription has expired.' }
  if (sub.visitsUsed >= sub.totalVisitsAllowed && sub.totalVisitsAllowed !== -1) {
    return { active: false, reason: 'All entries have been used.' }
  }
  return { active: true }
}
