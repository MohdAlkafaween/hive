export type PlanType = 'Daily' | 'Weekly' | 'Monthly'

export const PLAN_DEFAULTS: Record<PlanType, { price: number; totalVisitsAllowed: number; durationDays: number }> = {
  Daily:   { price: 3,  totalVisitsAllowed: 999, durationDays: 1  },
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

export function todayString(): string {
  return new Date().toISOString().slice(0, 10)
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
  if (sub.planType !== 'Daily' && sub.visitsUsed >= sub.totalVisitsAllowed) {
    return { active: false, reason: 'All visit days have been used.' }
  }
  return { active: true }
}
