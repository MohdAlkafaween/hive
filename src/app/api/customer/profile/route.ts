import prisma from '@/lib/prisma'
import { requireCustomerAuth } from '@/lib/customerAuth'
import { sanitizeString, sanitizePhone, isValidEmail } from '@/lib/sanitize'
import { checkRateLimit } from '@/lib/rateLimit'

export async function GET() {
  const student = await requireCustomerAuth()
  if (student instanceof Response) return student

  try {
    const full = await prisma.student.findUnique({
      where: { id: student.id },
      select: {
        id: true,
        studentNumber: true,
        fullName: true,
        phone: true,
        email: true,
        major: true,
        university: true,
        gender: true,
        dateOfBirth: true,
        emergencyContact: true,
        emergencyPhone: true,
        status: true,
        photoUrl: true,
        qrToken: true,
        createdAt: true,
        lifetimeCheckIns: true,
      },
    })

    if (!full) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    return Response.json({ student: full })
  } catch (e) {
    console.error('[GET /api/customer/profile]', e)
    return Response.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const student = await requireCustomerAuth()
  if (student instanceof Response) return student

  // Rate limit: 10 updates per hour per customer
  const limit = checkRateLimit(`customer-profile:${student.id}`, 10, 60 * 60 * 1000)
  if (limit.limited) {
    return Response.json({ error: 'Too many updates. Try again later.' }, { status: 429 })
  }

  try {
    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    // Strict field whitelist — only these fields can be updated by customer
    const allowedFields = ['phone', 'email', 'emergencyContact', 'emergencyPhone']
    const updateData: Record<string, string | null> = {}

    for (const key of Object.keys(body)) {
      if (!allowedFields.includes(key)) {
        return Response.json({ error: 'Invalid field in request' }, { status: 400 })
      }
    }

    if (body.phone !== undefined) {
      const phone = sanitizePhone(body.phone)
      if (!phone || phone.replace(/[\s\-()]/g, '').length < 7) {
        return Response.json({ error: 'Valid phone number required' }, { status: 400 })
      }
      updateData.phone = phone
    }

    if (body.email !== undefined) {
      if (body.email === null || body.email === '') {
        updateData.email = null
      } else {
        if (!isValidEmail(body.email)) {
          return Response.json({ error: 'Invalid email format' }, { status: 400 })
        }
        updateData.email = body.email.trim()
      }
    }

    if (body.emergencyContact !== undefined) {
      updateData.emergencyContact = body.emergencyContact ? sanitizeString(body.emergencyContact) : null
    }

    if (body.emergencyPhone !== undefined) {
      updateData.emergencyPhone = body.emergencyPhone ? sanitizePhone(body.emergencyPhone) : null
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const updated = await prisma.student.update({
      where: { id: student.id },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        emergencyContact: true,
        emergencyPhone: true,
      },
    })

    return Response.json({ student: updated })
  } catch (e: unknown) {
    console.error('[PATCH /api/customer/profile]', e)
    if ((e as { code?: string })?.code === 'P2002') {
      return Response.json({ error: 'Phone number already in use' }, { status: 409 })
    }
    return Response.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
