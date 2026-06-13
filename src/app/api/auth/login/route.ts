import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { encrypt } from '@/lib/auth'
import { checkRateLimit, clearRateLimit, getClientIp } from '@/lib/rateLimit'
import { isValidEmail } from '@/lib/sanitize'
import { todayString } from '@/lib/subscriptionLogic'
import { auditLog } from '@/lib/auditLog'
import { STAFF_COOKIE_NAME, STAFF_COOKIE_OPTIONS } from '@/lib/cookieConfig'

// Pre-computed valid bcrypt hash for timing-attack prevention
// This is a real hash of a random string — ensures bcrypt.compare() takes the same time
// whether or not the user exists in the database.
const DUMMY_HASH = bcrypt.hashSync('timing-attack-prevention-dummy', 12)

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req)

    // Secondary IP-based rate limit — prevents enumeration attacks across many emails
    const ipLimit = checkRateLimit(`login:ip:${ip}`, 30, 15 * 60 * 1000)
    if (ipLimit.limited) {
      auditLog('LOGIN_RATE_LIMITED', { ip, details: `IP rate limited. Retry after ${Math.ceil(ipLimit.retryAfterMs / 1000)}s` })
      return NextResponse.json(
        { error: 'Too many login attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(ipLimit.retryAfterMs / 1000)) } }
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

    // Primary per-email rate limit: 5 failed attempts per 15 minutes
    const emailLimit = checkRateLimit(`login:email:${email}`, 5, 15 * 60 * 1000)
    if (emailLimit.limited) {
      const retryMin = Math.ceil(emailLimit.retryAfterMs / 60000)
      auditLog('LOGIN_RATE_LIMITED', { ip, email, details: `Per-email rate limited. Retry after ${retryMin}m` })
      return NextResponse.json(
        { error: `Too many failed attempts for this account. Try again in ${retryMin} minute${retryMin === 1 ? '' : 's'}.` },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(emailLimit.retryAfterMs / 1000)) } }
      )
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
      auditLog('LOGIN_FAILED', { ip, email, userId: user.id, details: 'Wrong password' })
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Clear the per-email rate limit on successful login
    clearRateLimit(`login:email:${email}`)

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

    // Auto clock-in for staff shift tracking
    try {
      const today = todayString()
      const existingShift = await prisma.staffShift.findFirst({
        where: { userId: user.id, date: today, clockOut: null },
      })
      if (!existingShift) {
        await prisma.staffShift.create({
          data: { userId: user.id, email: user.email, role: user.role, date: today },
        })
      }
    } catch { /* don't block login if shift tracking fails */ }

    const sessionToken = await encrypt({ userId: user.id, email: user.email, role: user.role, permissions: user.permissions || '[]' })

    // Use next/headers cookies() — more reliable than res.cookies.set() in Next.js 15/16
    const cookieStore = await cookies()
    cookieStore.set(STAFF_COOKIE_NAME, sessionToken, STAFF_COOKIE_OPTIONS)

    return NextResponse.json({
      message: 'Login successful',
      user: { email: user.email, role: user.role },
    })
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
