import { decrypt } from '@/lib/auth'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'
import { CUSTOMER_COOKIE_NAME } from '@/lib/cookieConfig'

/**
 * Server-side auth guard for customer routes.
 * Mirrors the pattern of requireAuth() in authGuard.ts but checks the Student table.
 *
 * DO NOT import this file in middleware or any Edge Runtime context.
 * It imports Prisma which requires Node.js runtime.
 */
export async function requireCustomerAuth(): Promise<
  { id: number; fullName: string; phone: string; email: string | null; status: string; qrToken: string | null; photoUrl: string | null; studentNumber: number | null }
  | Response
> {
  // Read from customer-specific cookie (separate from staff 'session' cookie)
  const cookieStore = await cookies()
  const token = cookieStore.get(CUSTOMER_COOKIE_NAME)?.value
  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const session = await decrypt(token)
  if (!session) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Only customer tokens (type: 'customer') are accepted
  if (session.type !== 'customer' || !session.studentId) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  let student: {
    id: number
    fullName: string
    phone: string
    email: string | null
    status: string
    isLoginEnabled: boolean
    qrToken: string | null
    photoUrl: string | null
    studentNumber: number | null
  } | null

  try {
    student = await prisma.student.findUnique({
      where: { id: session.studentId as number },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        status: true,
        isLoginEnabled: true,
        qrToken: true,
        photoUrl: true,
        studentNumber: true,
      },
    })
  } catch (dbError) {
    // DB error — return 503, NOT 401 (same pattern as authGuard.ts)
    console.error('[requireCustomerAuth] DB lookup failed:', dbError)
    return new Response(
      JSON.stringify({ error: 'Service temporarily unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json', 'Retry-After': '2' } }
    )
  }

  if (!student) {
    return new Response(
      JSON.stringify({ error: 'Account not found' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (!student.isLoginEnabled) {
    return new Response(
      JSON.stringify({ error: 'Account login disabled' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (student.status === 'BANNED' || student.status === 'SUSPENDED') {
    return new Response(
      JSON.stringify({ error: 'Account suspended' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return {
    id: student.id,
    fullName: student.fullName,
    phone: student.phone,
    email: student.email,
    status: student.status,
    qrToken: student.qrToken,
    photoUrl: student.photoUrl,
    studentNumber: student.studentNumber,
  }
}
