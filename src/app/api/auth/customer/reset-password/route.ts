import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'
import { checkStaffRateLimit } from '@/lib/rateLimit'

export async function POST(req: Request) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'write')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    const { studentId, newPassword } = body

    // Validate studentId
    if (!studentId || !isValidId(String(studentId))) {
      return Response.json({ error: 'Invalid student ID' }, { status: 400 })
    }

    // Validate password
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return Response.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    if (newPassword.length > 128) {
      return Response.json({ error: 'Password too long' }, { status: 400 })
    }

    // Find student
    const student = await prisma.student.findUnique({
      where: { id: Number(studentId) },
      select: { id: true, fullName: true },
    })

    if (!student) {
      return Response.json({ error: 'Student not found' }, { status: 404 })
    }

    // Hash password (12 rounds — same as customer registration)
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    // Update student: set password and enable login
    await prisma.student.update({
      where: { id: student.id },
      data: {
        password: hashedPassword,
        isLoginEnabled: true,
      },
    })

    // Write audit log
    await prisma.staffAuditLog.create({
      data: {
        userId: session.userId as number,
        email: (session.email as string) || '',
        role: (session.role as string) || '',
        event: 'CUSTOMER_PASSWORD_RESET',
        details: `Reset customer password for ${student.fullName} (ID: ${student.id})`,
      },
    })

    return Response.json({ success: true, message: 'Password reset successfully' })
  } catch (e) {
    console.error('[POST /api/auth/customer/reset-password]', e)
    return Response.json({ error: 'Failed to reset password' }, { status: 500 })
  }
}
