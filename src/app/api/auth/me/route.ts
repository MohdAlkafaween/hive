import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await verifyAuth()
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId as number },
    select: { id: true, email: true, role: true, permissions: true }
  })

  return NextResponse.json({ user })
}
