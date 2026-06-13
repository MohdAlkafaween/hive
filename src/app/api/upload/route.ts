import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/authGuard'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import path from 'path'
import fs from 'fs/promises'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

// Map MIME types to file extensions (derive from MIME, not user filename)
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/**
 * Validate that file content magic bytes match the claimed MIME type.
 * Prevents uploading non-image files with spoofed MIME types.
 */
function validateMagicBytes(bytes: Uint8Array, mime: string): boolean {
  if (bytes.length < 12) return false

  switch (mime) {
    case 'image/png':
      // PNG: \x89PNG
      return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
    case 'image/jpeg':
      // JPEG: \xFF\xD8
      return bytes[0] === 0xFF && bytes[1] === 0xD8
    case 'image/webp':
      // WebP: RIFF....WEBP
      return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
             bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    default:
      return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'STAFF')
    if (session instanceof Response) return session

    // Rate limit: 20 uploads per minute per IP
    const ip = getClientIp(req)
    const limit = checkRateLimit(`upload:${ip}`, 20, 60 * 1000)
    if (limit.limited) {
      return Response.json({ error: 'Too many uploads. Please wait a moment.' }, { status: 429 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json({ error: 'Only JPEG, PNG, and WebP images are allowed' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return Response.json({ error: 'File size must be under 5MB' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const bytes = new Uint8Array(buffer)

    // Validate magic bytes match claimed MIME type
    if (!validateMagicBytes(bytes, file.type)) {
      return Response.json({ error: 'File content does not match the claimed image type' }, { status: 400 })
    }

    // Derive extension from validated MIME type, NOT user-provided filename
    const ext = MIME_TO_EXT[file.type] || 'jpg'
    const safeName = `menu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    // Save to public/uploads/menu/
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'menu')
    await fs.mkdir(uploadDir, { recursive: true })

    await fs.writeFile(path.join(uploadDir, safeName), buffer)

    const imageUrl = `/uploads/menu/${safeName}`
    return Response.json({ imageUrl })
  } catch (e) {
    console.error('[POST /api/upload]', e)
    return Response.json({ error: 'Upload failed' }, { status: 500 })
  }
}
