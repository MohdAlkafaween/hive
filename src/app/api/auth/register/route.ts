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
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    const { email, password, role, name, phone } = body

    if (!email || !password) {
      return Response.json({ error: 'Email and password required' }, { status: 400 })
    }

    if (!isValidEmail(email)) {
      return Response.json({ error: 'Invalid email format' }, { status: 400 })
    }

    const passwordCheck = isStrongPassword(password)
    if (!passwordCheck.valid) {
      return Response.json({ error: passwordCheck.reason }, { status: 400 })
    }

    // Only ADMINs can create other ADMINs — prevents privilege escalation
    const validRoles = ['STAFF', 'MANAGER', 'ADMIN']
    let userRole = validRoles.includes(role) ? role : 'STAFF'
    if (role === 'ADMIN' && (session.role as string) !== 'ADMIN') {
      return Response.json({ error: 'Only admins can create admin accounts' }, { status: 403 })
    }

    // Validate permissions for MANAGER role
    let permissions = '[]'
    if (userRole === 'MANAGER' && Array.isArray(body.permissions)) {
      const validPages = ['/', '/directory', '/logs', '/stats', '/barista', '/admin']
      const filtered = body.permissions.filter((p: string) => validPages.includes(p))
      permissions = JSON.stringify(filtered)
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return Response.json({ error: 'User already exists' }, { status: 400 })
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

    return Response.json({ message: 'User registered', user: { email: user.email, role: user.role } })
  } catch {
    return Response.json({ error: 'Registration failed' }, { status: 500 })
  }
}
