import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { encrypt } from '@/lib/auth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { sanitizeString, sanitizePhone, isValidEmail } from '@/lib/sanitize'
import { CUSTOMER_COOKIE_NAME, getCookieOptions, CUSTOMER_MAX_AGE } from '@/lib/cookieConfig'

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req)

    // IP rate limit: 15/hour (generous for shared WiFi — whole shop shares one IP)
    const ipLimit = checkRateLimit(`customer-register:ip:${ip}`, 15, 60 * 60 * 1000)
    if (ipLimit.limited) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(ipLimit.retryAfterMs / 1000)) } }
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

    // Validate and sanitize inputs
    const fullName = sanitizeString(body.fullName)
    if (!fullName || fullName.length < 2 || fullName.length > 100) {
      return NextResponse.json({ error: 'Name is required (2-100 characters)' }, { status: 400 })
    }

    const phone = sanitizePhone(body.phone)
    if (!phone || phone.replace(/[\s\-()]/g, '').length < 7) {
      return NextResponse.json({ error: 'Valid phone number required (min 7 digits)' }, { status: 400 })
    }

    // Per-phone rate limit: 3/hour (prevents spam-registering same phone)
    const phoneLimit = checkRateLimit(`customer-register:phone:${phone}`, 3, 60 * 60 * 1000)
    if (phoneLimit.limited) {
      return NextResponse.json(
        { error: 'Too many registration attempts for this phone number. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(phoneLimit.retryAfterMs / 1000)) } }
      )
    }

    // Email is optional
    let email: string | null = null
    if (body.email && typeof body.email === 'string' && body.email.trim()) {
      if (!isValidEmail(body.email.trim())) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
      }
      email = body.email.trim()
    }

    // Password: min 6 chars for customers (simpler than staff 8-char requirement)
    const password = body.password
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }
    if (password.length > 128) {
      return NextResponse.json({ error: 'Password too long' }, { status: 400 })
    }

    // Check if phone already exists
    // Re-include password (globally omitted) — needed to detect existing registration
    const existingStudent = await prisma.student.findUnique({ where: { phone }, omit: { password: false } })

    if (existingStudent) {
      if (existingStudent.password) {
        // Student already has a password — they're already registered
        return NextResponse.json(
          { error: 'An account with this phone number already exists. Please log in.' },
          { status: 409 }
        )
      }

      // Staff-registered student with no password — link self-registration to existing profile
      const hashedPassword = await bcrypt.hash(password, 12)
      const updated = await prisma.student.update({
        where: { id: existingStudent.id },
        data: {
          password: hashedPassword,
          isLoginEnabled: true,
          lastLoginAt: new Date(),
          // Update name/email only if existing values are empty
          ...(email && !existingStudent.email ? { email } : {}),
        },
      })

      const sessionToken = await encrypt(
        { type: 'customer', studentId: updated.id },
        '7d'
      )

      const cookieStore = await cookies()
      cookieStore.set(CUSTOMER_COOKIE_NAME, sessionToken, getCookieOptions(CUSTOMER_MAX_AGE))

      return NextResponse.json({
        success: true,
        student: { id: updated.id, fullName: updated.fullName, phone: updated.phone },
        linked: true, // Indicates this was linked to existing staff-created profile
      })
    }

    // New student — create from scratch
    const hashedPassword = await bcrypt.hash(password, 12)
    const qrToken = randomBytes(16).toString('hex')

    const student = await prisma.$transaction(async (tx) => {
      // Generate studentNumber using the same pattern as POST /api/students
      const setting = await tx.appSetting.findUnique({ where: { key: 'nextStudentNumber' } })
      const nextNum = setting ? parseInt(setting.value) : 1
      await tx.appSetting.upsert({
        where: { key: 'nextStudentNumber' },
        create: { key: 'nextStudentNumber', value: String(nextNum + 1) },
        update: { value: String(nextNum + 1) },
      })
      return tx.student.create({
        data: {
          fullName,
          phone,
          email,
          password: hashedPassword,
          isLoginEnabled: true,
          lastLoginAt: new Date(),
          qrToken,
          studentNumber: nextNum,
          status: 'ACTIVE',
        },
      })
    })

    const sessionToken = await encrypt(
      { type: 'customer', studentId: student.id },
      '7d'
    )

    const cookieStore = await cookies()
    cookieStore.set(CUSTOMER_COOKIE_NAME, sessionToken, getCookieOptions(CUSTOMER_MAX_AGE))

    return NextResponse.json({
      success: true,
      student: { id: student.id, fullName: student.fullName, phone: student.phone },
    }, { status: 201 })
  } catch (e: unknown) {
    console.error('[POST /api/auth/customer/register]', e)
    if ((e as { code?: string })?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Phone number already in use' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
