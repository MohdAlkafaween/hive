import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

// POST — upload student photo
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'REGISTERATION_COUNTER')
    if (session instanceof Response) return session
    const { id } = await params
    if (!isValidId(id)) return Response.json({ error: 'Invalid student ID' }, { status: 400 })

    const formData = await req.formData()
    const file = formData.get('photo') as File | null
    if (!file) return Response.json({ error: 'No photo provided' }, { status: 400 })

    if (file.size > 5 * 1024 * 1024) {
      return Response.json({ error: 'Photo must be under 5MB' }, { status: 400 })
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      return Response.json({ error: 'Only JPEG, PNG, WebP allowed' }, { status: 400 })
    }

    const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1]
    const filename = `student-${id}-${Date.now()}.${ext}`
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'photos')
    await mkdir(uploadDir, { recursive: true })
    const filepath = join(uploadDir, filename)

    const bytes = new Uint8Array(await file.arrayBuffer())
    await writeFile(filepath, bytes)

    const photoUrl = `/uploads/photos/${filename}`
    await prisma.student.update({ where: { id: Number(id) }, data: { photoUrl } })

    return Response.json({ photoUrl })
  } catch (e) {
    console.error('[POST /api/students/[id]/photo]', e)
    return Response.json({ error: 'Upload failed' }, { status: 500 })
  }
}
