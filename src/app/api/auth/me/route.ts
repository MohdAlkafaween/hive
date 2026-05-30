import { verifyAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'

// NOTE: Returning role/permissions is intentional for SPA UI rendering (sidebar, route guards).
// No sensitive data (password, tokens) is exposed. This is the standard pattern for SPAs.
export async function GET() {
  const session = await verifyAuth()
  if (!session) {
    return Response.json({ user: null }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId as number },
    select: { id: true, email: true, role: true, permissions: true }
  })

  return Response.json({ user })
}
