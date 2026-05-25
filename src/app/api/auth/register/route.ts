import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { requireAuth } from '@/lib/authGuard'
import { isValidEmail, isStrongPassword } from '@/lib/sanitize'

// FIX #2: Registration now requires ADMIN auth — no open registration
export async function POST(req: Request) {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

    const { email, password, role, name, phone } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    const passwordCheck = isStrongPassword(password)
    if (!passwordCheck.valid) {
      return NextResponse.json({ error: passwordCheck.reason }, { status: 400 })
    }

    // Only allow these roles
    const allowedRoles = ['REGISTERATION_COUNTER', 'BARISTA', 'MANAGER', 'ADMIN']
    const userRole = allowedRoles.includes(role) ? role : 'REGISTERATION_COUNTER'

    // Validate permissions for MANAGER role
    let permissions = '[]'
    if (userRole === 'MANAGER' && Array.isArray(body.permissions)) {
      const validPages = ['/', '/directory', '/logs', '/stats', '/barista', '/admin']
      const filtered = body.permissions.filter((p: string) => validPages.includes(p))
      permissions = JSON.stringify(filtered)
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 12) // Increased rounds from 10 to 12
    const user = await prisma.user.create({
      data: {
        email,
        password: passwordHash,
        role: userRole,
        permissions,
        name: typeof name === 'string' ? name.trim().slice(0, 100) : '',
        phone: typeof phone === 'string' ? phone.trim().slice(0, 20) : '',
        createdById: session.userId as number,
      },
    })

    return NextResponse.json({ message: 'User registered', user: { email: user.email, role: user.role } })
  } catch {
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
