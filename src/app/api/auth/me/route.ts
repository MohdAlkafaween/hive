import { decrypt } from '@/lib/auth'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'
import { STAFF_COOKIE_NAME, CUSTOMER_COOKIE_NAME } from '@/lib/cookieConfig'

// NOTE: Returning role/permissions is intentional for SPA UI rendering (sidebar, route guards).
// No sensitive data (password, tokens) is exposed. This is the standard pattern for SPAs.
//
// Query parameter ?type=staff|customer controls which session to check:
//   - ?type=staff   → only reads the staff 'session' cookie (used by AppLayoutInner / useAuth)
//   - ?type=customer → only reads the 'customer-session' cookie (used by CustomerProvider)
//   - no ?type      → checks staff first, then customer (backward-compatible)
//
// This prevents session bleed: a staff page never accidentally gets a customer response,
// and a customer page never accidentally gets a staff response.

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const requestedType = url.searchParams.get('type') // 'staff' | 'customer' | null

    const cookieStore = await cookies()

    // ─── Staff-only mode ───
    if (requestedType === 'staff') {
      const staffToken = cookieStore.get(STAFF_COOKIE_NAME)?.value
      if (!staffToken) {
        return Response.json({ user: null }, { status: 401 })
      }
      const session = await decrypt(staffToken)
      if (!session || !session.userId) {
        return Response.json({ user: null }, { status: 401 })
      }
      // Reject customer tokens that ended up in the staff cookie (legacy bug)
      if (session.type === 'customer') {
        return Response.json({ user: null }, { status: 401 })
      }
      const user = await prisma.user.findUnique({
        where: { id: session.userId as number },
        select: { id: true, email: true, role: true, permissions: true },
      })
      if (!user) {
        return Response.json({ user: null }, { status: 401 })
      }
      return Response.json({ type: 'staff', user })
    }

    // ─── Customer-only mode ───
    if (requestedType === 'customer') {
      const customerToken = cookieStore.get(CUSTOMER_COOKIE_NAME)?.value
      if (!customerToken) {
        return Response.json({ user: null }, { status: 401 })
      }
      const session = await decrypt(customerToken)
      if (!session || session.type !== 'customer' || !session.studentId) {
        return Response.json({ user: null }, { status: 401 })
      }
      const student = await prisma.student.findUnique({
        where: { id: session.studentId as number },
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          status: true,
          qrToken: true,
          photoUrl: true,
          studentNumber: true,
        },
      })
      if (!student) {
        return Response.json({ user: null }, { status: 401 })
      }
      return Response.json({ type: 'customer', student })
    }

    // ─── Default mode (no ?type) — backward-compatible: check staff first, then customer ───
    const staffToken = cookieStore.get(STAFF_COOKIE_NAME)?.value
    if (staffToken) {
      const session = await decrypt(staffToken)
      if (session && session.userId && session.type !== 'customer') {
        const user = await prisma.user.findUnique({
          where: { id: session.userId as number },
          select: { id: true, email: true, role: true, permissions: true },
        })
        if (user) {
          return Response.json({ type: 'staff', user })
        }
      }
    }

    const customerToken = cookieStore.get(CUSTOMER_COOKIE_NAME)?.value
    if (customerToken) {
      const session = await decrypt(customerToken)
      if (session && session.type === 'customer' && session.studentId) {
        const student = await prisma.student.findUnique({
          where: { id: session.studentId as number },
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            status: true,
            qrToken: true,
            photoUrl: true,
            studentNumber: true,
          },
        })
        if (student) {
          return Response.json({ type: 'customer', student })
        }
      }
    }

    return Response.json({ user: null }, { status: 401 })
  } catch (e) {
    console.error('[GET /api/auth/me]', e)
    return Response.json({ error: 'Service temporarily unavailable' }, { status: 503 })
  }
}
