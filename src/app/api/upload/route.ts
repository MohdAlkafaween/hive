import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/authGuard'
import path from 'path'
import fs from 'fs/promises'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN', 'BARISTA')
    if (session instanceof Response) return session

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json({ error: 'Only JPEG, PNG, WebP, and GIF images are allowed' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return Response.json({ error: 'File size must be under 5MB' }, { status: 400 })
    }

    // Generate unique filename
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safeName = `menu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    // Save to public/uploads/menu/
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'menu')
    await fs.mkdir(uploadDir, { recursive: true })

    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(path.join(uploadDir, safeName), buffer)

    const imageUrl = `/uploads/menu/${safeName}`
    return Response.json({ imageUrl })
  } catch (e) {
    console.error('[POST /api/upload]', e)
    return Response.json({ error: 'Upload failed' }, { status: 500 })
  }
}
