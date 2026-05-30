import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

/**
 * Validate that file content magic bytes match the claimed MIME type.
 */
function validateMagicBytes(bytes: Uint8Array, mime: string): boolean {
  if (bytes.length < 12) return false
  switch (mime) {
    case 'image/png':
      return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
    case 'image/jpeg':
      return bytes[0] === 0xFF && bytes[1] === 0xD8
    case 'image/webp':
      return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
             bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    default:
      return false
  }
}

// POST — upload student photo
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'STAFF')
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

    const bytes = new Uint8Array(await file.arrayBuffer())

    // Validate magic bytes match claimed MIME type
    if (!validateMagicBytes(bytes, file.type)) {
      return Response.json({ error: 'File content does not match the claimed image type' }, { status: 400 })
    }

    // Derive extension from validated MIME type, not user filename
    const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
    const filename = `student-${id}-${Date.now()}.${ext}`
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'photos')
    await mkdir(uploadDir, { recursive: true })
    const filepath = join(uploadDir, filename)

    await writeFile(filepath, bytes)

    const photoUrl = `/uploads/photos/${filename}`
    await prisma.student.update({ where: { id: Number(id) }, data: { photoUrl } })

    return Response.json({ photoUrl })
  } catch (e) {
    console.error('[POST /api/students/[id]/photo]', e)
    return Response.json({ error: 'Upload failed' }, { status: 500 })
  }
}
