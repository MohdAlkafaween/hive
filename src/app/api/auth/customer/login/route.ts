import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { encrypt } from '@/lib/auth'
import { checkRateLimit, clearRateLimit, getClientIp } from '@/lib/rateLimit'
import { sanitizePhone } from '@/lib/sanitize'
import { CUSTOMER_COOKIE_NAME, getCookieOptions, CUSTOMER_MAX_AGE } from '@/lib/cookieConfig'

// Pre-computed valid bcrypt hash for timing-attack prevention
const DUMMY_HASH = bcrypt.hashSync('timing-attack-prevention-dummy', 12)

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req)

    // IP-based rate limit: 30 per 15 minutes (generous for shared WiFi)
    const ipLimit = checkRateLimit(`customer-login:ip:${ip}`, 30, 15 * 60 * 1000)
    if (ipLimit.limited) {
      return NextResponse.json(
        { error: 'Too many login attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(ipLimit.retryAfterMs / 1000)) } }
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

    const { password } = body

    if (!body.phone || !password) {
      return NextResponse.json({ error: 'Phone number and password required' }, { status: 400 })
    }

    if (typeof password !== 'string' || password.length > 128) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 400 })
    }

    // Normalize phone format before lookup
    const phone = sanitizePhone(body.phone)
    if (!phone || phone.replace(/[\s\-()]/g, '').length < 7) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    // Per-phone rate limit: 5 per 15 minutes
    const phoneLimit = checkRateLimit(`customer-login:phone:${phone}`, 5, 15 * 60 * 1000)
    if (phoneLimit.limited) {
      const retryMin = Math.ceil(phoneLimit.retryAfterMs / 60000)
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${retryMin} minute${retryMin === 1 ? '' : 's'}.` },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(phoneLimit.retryAfterMs / 1000)) } }
      )
    }

    // Re-include password (globally omitted) — needed for the bcrypt compare below
    const student = await prisma.student.findUnique({ where: { phone }, omit: { password: false } })

    // Constant-time comparison — don't reveal whether phone exists
    if (!student) {
      await bcrypt.compare(password, DUMMY_HASH)
      return NextResponse.json({ error: 'Invalid phone number or password' }, { status: 401 })
    }

    // Student exists but has no password (staff-registered, never set up login)
    if (!student.password) {
      await bcrypt.compare(password, DUMMY_HASH)
      return NextResponse.json({ error: 'Invalid phone number or password' }, { status: 401 })
    }

    // Check login enabled
    if (!student.isLoginEnabled) {
      return NextResponse.json({ error: 'Account login disabled. Contact staff.' }, { status: 401 })
    }

    // Check status
    if (student.status === 'BANNED' || student.status === 'SUSPENDED') {
      return NextResponse.json({ error: 'Account suspended. Contact staff.' }, { status: 401 })
    }

    const isMatch = await bcrypt.compare(password, student.password)
    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid phone number or password' }, { status: 401 })
    }

    // Clear the per-phone rate limit on successful login
    clearRateLimit(`customer-login:phone:${phone}`)

    // Update lastLoginAt
    try {
      await prisma.student.update({
        where: { id: student.id },
        data: { lastLoginAt: new Date() },
      })
    } catch { /* don't block login if update fails */ }

    const sessionToken = await encrypt(
      { type: 'customer', studentId: student.id },
      '7d'
    )

    // Use next/headers cookies() — more reliable than res.cookies.set() in Next.js 15/16
    const cookieStore = await cookies()
    cookieStore.set(CUSTOMER_COOKIE_NAME, sessionToken, getCookieOptions(CUSTOMER_MAX_AGE))

    return NextResponse.json({
      success: true,
      student: { id: student.id, fullName: student.fullName, phone: student.phone },
    })
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
