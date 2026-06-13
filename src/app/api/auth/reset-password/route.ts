import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { requireAuth } from '@/lib/authGuard'
import { isStrongPassword } from '@/lib/sanitize'
import { isValidId } from '@/lib/sanitize'
import { getClientIp } from '@/lib/rateLimit'

/**
 * POST /api/auth/reset-password
 * Admin-only: reset any staff member's password (including their own)
 *
 * Body: { userId: number, newPassword: string }
 *
 * Security controls:
 * - requireAuth('ADMIN') — live DB role check, not just JWT claim
 * - Password strength validation
 * - bcrypt 12 rounds
 * - Audit trail in StaffAuditLog table
 * - Does NOT reveal whether userId exists (returns generic error)
 */
export async function POST(req: Request) {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    const { userId, newPassword } = body

    // Validate inputs
    if (!isValidId(userId)) {
      return Response.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    if (!newPassword || typeof newPassword !== 'string') {
      return Response.json({ error: 'New password is required' }, { status: 400 })
    }

    const passwordCheck = isStrongPassword(newPassword)
    if (!passwordCheck.valid) {
      return Response.json({ error: passwordCheck.reason }, { status: 400 })
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { id: true, email: true, role: true },
    })

    if (!targetUser) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    // Hash new password with bcrypt 12 rounds
    const passwordHash = await bcrypt.hash(newPassword, 12)

    // Update password
    await prisma.user.update({
      where: { id: targetUser.id },
      data: { password: passwordHash },
    })

    // Audit log — persist to DB
    const ip = getClientIp(req)
    const adminEmail = session.email as string
    const isSelf = targetUser.id === (session.userId as number)

    await prisma.staffAuditLog.create({
      data: {
        userId: targetUser.id,
        email: targetUser.email,
        role: targetUser.role,
        event: 'PASSWORD_RESET_BY_ADMIN',
        ip,
        details: isSelf
          ? `Admin reset their own password`
          : `Password reset by admin: ${adminEmail}`,
      },
    })


    return Response.json({
      message: `Password reset successfully for ${targetUser.email}`,
    })
  } catch (e) {
    console.error('[POST /api/auth/reset-password]', e)
    return Response.json({ error: 'Failed to reset password' }, { status: 500 })
  }
}
