import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

// FIX #1: Seed only works when no admin exists (first-time setup only)
// Also rate-limited to prevent abuse
export async function GET(req: Request) {
  try {
    const ip = getClientIp(req)
    const limit = checkRateLimit(`seed:${ip}`, 3, 60 * 60 * 1000) // 3 attempts per hour
    if (limit.limited) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
    }

    // Only seed if NO admin user exists — prevents password reset attacks
    const existingAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
    if (existingAdmin) {
      return NextResponse.json({ error: 'Admin already exists. Seed is disabled.' }, { status: 403 })
    }

    const passwordHash = await bcrypt.hash('uni.study@2000.house', 12)
    const user = await prisma.user.create({
      data: {
        email: 'Hive.study@admin.jordan',
        password: passwordHash,
        role: 'ADMIN',
      },
    })
    return NextResponse.json({ message: 'Admin seeded', email: user.email })
  } catch {
    // FIX #7: Never leak error details to client
    return NextResponse.json({ error: 'Seed failed' }, { status: 500 })
  }
}
