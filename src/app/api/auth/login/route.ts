import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { encrypt } from '@/lib/auth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { isValidEmail } from '@/lib/sanitize'
import { auditLog } from '@/lib/auditLog'

// Pre-computed valid bcrypt hash for timing-attack prevention
// This is a real hash of a random string — ensures bcrypt.compare() takes the same time
// whether or not the user exists in the database.
const DUMMY_HASH = bcrypt.hashSync('timing-attack-prevention-dummy', 12)

export async function POST(req: Request) {
  try {
    // Rate limit: 5 attempts per 15 minutes per IP
    const ip = getClientIp(req)
    const limit = checkRateLimit(`login:${ip}`, 5, 15 * 60 * 1000)
    if (limit.limited) {
      auditLog('LOGIN_RATE_LIMITED', { ip, details: `Retry after ${Math.ceil(limit.retryAfterMs / 1000)}s` })
      return NextResponse.json(
        { error: 'Too many login attempts. Try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) },
        }
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    if (typeof password !== 'string' || password.length > 128) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })

    // Constant-time comparison — don't reveal whether user exists
    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH)
      auditLog('LOGIN_FAILED', { ip, email, details: 'User not found' })
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      checkRateLimit(`login:email:${email}`, 5, 15 * 60 * 1000)
      auditLog('LOGIN_FAILED', { ip, email, userId: user.id, details: 'Wrong password' })
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Check if account is disabled
    if (user.isActive === false) {
      auditLog('LOGIN_BLOCKED', { ip, email, userId: user.id, details: 'Account disabled' })
      return NextResponse.json({ error: 'Account is disabled. Contact your administrator.' }, { status: 403 })
    }

    auditLog('LOGIN_SUCCESS', { ip, email, userId: user.id })

    // Persist login event to DB audit trail
    try {
      await prisma.staffAuditLog.create({
        data: {
          userId: user.id,
          email: user.email,
          role: user.role,
          event: 'LOGIN',
          ip,
        },
      })
    } catch { /* don't block login if audit DB write fails */ }

    const sessionToken = await encrypt({ userId: user.id, email: user.email, role: user.role, permissions: user.permissions || '[]' })

    const res = NextResponse.json({
      message: 'Login successful',
      user: { email: user.email, role: user.role },
    })
    res.cookies.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', // Upgraded from 'lax' for CSRF protection
      path: '/',
      maxAge: 60 * 60 * 8, // 8 hours (one shift)
    })

    return res
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
