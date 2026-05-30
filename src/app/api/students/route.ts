import { NextRequest } from 'next/server'
import { randomBytes } from 'crypto'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { sanitizeString, sanitizePhone, sanitizeRfid } from '@/lib/sanitize'

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN', 'STAFF')
    if (session instanceof Response) return session

    const search = req.nextUrl.searchParams.get('search')?.trim()

    let where = {}
    if (search) {
      // Search by student number, name, or phone
      const numSearch = parseInt(search)
      if (!isNaN(numSearch) && search.length <= 6) {
        // Looks like a student number
        where = {
          OR: [
            { studentNumber: numSearch },
            { fullName: { contains: search } },
            { phone: { contains: search } },
          ],
        }
      } else {
        where = {
          OR: [
            { fullName: { contains: search } },
            { phone: { contains: search } },
          ],
        }
      }
    }

    // Pagination: default page=1, limit=50 (capped at 200)
    const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1)
    const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 50))
    const skip = (page - 1) * limit

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: search ? 10 : limit,
        ...(search ? {} : { skip }),
        include: {
          subscriptions: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      search ? Promise.resolve(0) : prisma.student.count({ where }),
    ])
    return Response.json({ students, total, page, limit })
  } catch (e) {
    console.error('[GET /api/students]', e)
    return Response.json({ error: 'Failed to fetch students' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN', 'STAFF')
    if (session instanceof Response) return session

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    const fullName = sanitizeString(body.fullName)
    const phone = sanitizePhone(body.phone)
    const major = body.major ? sanitizeString(body.major) : null
    const rfidUuid = sanitizeRfid(body.rfidUuid)
    const email = body.email ? sanitizeString(body.email) : null
    const university = body.university ? sanitizeString(body.university) : null
    const gender = body.gender && ['male', 'female'].includes(body.gender) ? body.gender : null
    const emergencyContact = body.emergencyContact ? sanitizeString(body.emergencyContact) : null
    const emergencyPhone = body.emergencyPhone ? sanitizeString(body.emergencyPhone) : null
    const referralSource = body.referralSource ? sanitizeString(body.referralSource) : null
    const dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null

    if (!fullName || fullName.length < 2) return Response.json({ error: 'Valid name required (min 2 chars)' }, { status: 400 })
    if (!phone || phone.length < 7) return Response.json({ error: 'Valid phone required (min 7 digits)' }, { status: 400 })

    const qrToken = randomBytes(16).toString('hex')

    const student = await prisma.$transaction(async (tx) => {
      const setting = await tx.appSetting.findUnique({ where: { key: 'nextStudentNumber' } })
      const nextNum = setting ? parseInt(setting.value) : 1
      await tx.appSetting.upsert({
        where: { key: 'nextStudentNumber' },
        create: { key: 'nextStudentNumber', value: String(nextNum + 1) },
        update: { value: String(nextNum + 1) },
      })
      return tx.student.create({
        data: {
          fullName, phone, major, rfidUuid, qrToken, studentNumber: nextNum,
          email, university, gender, emergencyContact, emergencyPhone, referralSource,
          dateOfBirth: dateOfBirth && !isNaN(dateOfBirth.getTime()) ? dateOfBirth : null,
        },
      })
    })
    return Response.json(student, { status: 201 })
  } catch (e: unknown) {
    console.error('[POST /api/students]', e)
    if ((e as { code?: string })?.code === 'P2002') {
      return Response.json({ error: 'Phone number or RFID already in use' }, { status: 409 })
    }
    return Response.json({ error: 'Failed to create student' }, { status: 500 })
  }
}
