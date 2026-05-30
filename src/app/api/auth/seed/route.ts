import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

// FIX #1: Seed only works when no admin exists (first-time setup only)
// Also rate-limited and gated by ALLOW_SEED env var
export async function GET(req: Request) {
  try {
    // Must explicitly enable seeding via environment variable
    if (process.env.ALLOW_SEED !== 'true') {
      return Response.json({ error: 'Seed endpoint is disabled. Set ALLOW_SEED=true to enable.' }, { status: 403 })
    }

    const ip = getClientIp(req)
    const limit = checkRateLimit(`seed:${ip}`, 3, 60 * 60 * 1000) // 3 attempts per hour
    if (limit.limited) {
      return Response.json({ error: 'Rate limited' }, { status: 429 })
    }

    // Only seed if NO admin user exists — prevents password reset attacks
    const existingAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
    if (existingAdmin) {
      return Response.json({ error: 'Admin already exists. Seed is disabled.' }, { status: 403 })
    }

    // Use environment variables for seed credentials; fall back to defaults only in development
    const seedEmail = process.env.SEED_ADMIN_EMAIL || 'Hive.study@admin.jordan'
    const seedPassword = process.env.SEED_ADMIN_PASSWORD || 'uni.study@2000.house'
    if (process.env.NODE_ENV === 'production' && !process.env.SEED_ADMIN_PASSWORD) {
      return Response.json({ error: 'SEED_ADMIN_PASSWORD must be set in production' }, { status: 500 })
    }

    const passwordHash = await bcrypt.hash(seedPassword, 12)
    const user = await prisma.user.create({
      data: {
        email: seedEmail,
        password: passwordHash,
        role: 'ADMIN',
      },
    })
    return Response.json({ message: 'Admin seeded', email: user.email })
  } catch {
    // FIX #7: Never leak error details to client
    return Response.json({ error: 'Seed failed' }, { status: 500 })
  }
}
