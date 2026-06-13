/**
 * Public-safe projection of a Student record for check-in responses.
 *
 * SECURITY: /api/checkin and /api/checkin/qr are PUBLIC endpoints (kiosk mode).
 * Their responses must NEVER include: password, qrToken, rfidUuid, phone, email,
 * dateOfBirth, emergencyContact, emergencyPhone, isLoginEnabled, or notes.
 * Every student object placed in a check-in Response MUST pass through this.
 */

interface SubscriptionLike {
  id: number
  planType: string
  isActive: boolean
  isFrozen: boolean
  startDate: Date | string
  expiryDate: Date | string
  totalVisitsAllowed: number
  visitsUsed: number
}

interface StudentLike {
  id: number
  fullName: string
  studentNumber?: number | null
  photoUrl?: string | null
  status?: string
  lifetimeCheckIns?: number
  subscriptions?: SubscriptionLike[]
}

export function safeStudentResponse(student: StudentLike) {
  return {
    id: student.id,
    fullName: student.fullName,
    studentNumber: student.studentNumber ?? null,
    photoUrl: student.photoUrl ?? null,
    status: student.status ?? 'ACTIVE',
    lifetimeCheckIns: student.lifetimeCheckIns ?? 0,
    ...(student.subscriptions
      ? {
          subscriptions: student.subscriptions.map((sub) => ({
            id: sub.id,
            planType: sub.planType,
            isActive: sub.isActive,
            isFrozen: sub.isFrozen,
            startDate: sub.startDate,
            expiryDate: sub.expiryDate,
            totalVisitsAllowed: sub.totalVisitsAllowed,
            visitsUsed: sub.visitsUsed,
          })),
        }
      : {}),
  }
}
