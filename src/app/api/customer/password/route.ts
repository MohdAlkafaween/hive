import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { requireCustomerAuth } from '@/lib/customerAuth'
import { checkRateLimit } from '@/lib/rateLimit'

export async function PATCH(req: Request) {
  try {
    const student = await requireCustomerAuth()
    if (student instanceof Response) return student

    // Rate limit: 5 per customer per hour
    const rl = checkRateLimit(`customer-password:${student.id}`, 5, 60 * 60 * 1000)
    if (rl.limited) {
      return Response.json(
        { error: 'Too many attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    const { currentPassword, newPassword } = body

    // Validate inputs
    if (!currentPassword || typeof currentPassword !== 'string') {
      return Response.json({ error: 'Current password is required' }, { status: 400 })
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return Response.json({ error: 'New password must be at least 6 characters' }, { status: 400 })
    }
    if (newPassword.length > 128) {
      return Response.json({ error: 'Password too long' }, { status: 400 })
    }

    // Fetch current password hash
    const record = await prisma.student.findUnique({
      where: { id: student.id },
      select: { password: true },
    })

    if (!record || !record.password) {
      return Response.json({ error: 'No password set. Please contact staff.' }, { status: 400 })
    }

    // Constant-time comparison via bcrypt
    const matches = await bcrypt.compare(currentPassword, record.password)
    if (!matches) {
      return Response.json({ error: 'Current password is incorrect' }, { status: 401 })
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    await prisma.student.update({
      where: { id: student.id },
      data: { password: hashedPassword },
    })

    return Response.json({ success: true, message: 'Password changed successfully' })
  } catch (e) {
    console.error('[PATCH /api/customer/password]', e)
    return Response.json({ error: 'Failed to change password' }, { status: 500 })
  }
}
