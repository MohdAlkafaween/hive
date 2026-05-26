import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId, sanitizeString } from '@/lib/sanitize'

// GET notes for a student
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'REGISTERATION_COUNTER')
    if (session instanceof Response) return session
    const { id } = await params
    if (!isValidId(id)) return Response.json({ error: 'Invalid student ID' }, { status: 400 })

    const notes = await prisma.studentNote.findMany({
      where: { studentId: Number(id) },
      orderBy: { createdAt: 'desc' },
    })
    return Response.json(notes)
  } catch (e) {
    console.error('[GET /api/students/[id]/notes]', e)
    return Response.json({ error: 'Failed to load notes' }, { status: 500 })
  }
}

// POST — add a note
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'REGISTERATION_COUNTER')
    if (session instanceof Response) return session
    const { id } = await params
    if (!isValidId(id)) return Response.json({ error: 'Invalid student ID' }, { status: 400 })

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 })

    const content = sanitizeString(body.content)
    if (!content || content.length < 1 || content.length > 1000) {
      return Response.json({ error: 'Note must be 1-1000 characters' }, { status: 400 })
    }

    const note = await prisma.studentNote.create({
      data: {
        studentId: Number(id),
        content,
        authorId: session.userId as number,
        authorName: session.email as string,
      },
    })
    return Response.json(note, { status: 201 })
  } catch (e) {
    console.error('[POST /api/students/[id]/notes]', e)
    return Response.json({ error: 'Failed to add note' }, { status: 500 })
  }
}

// DELETE — delete a note (admin only)
export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const { searchParams } = new URL(req.url)
    const noteId = searchParams.get('noteId')
    if (!noteId || !isValidId(noteId)) return Response.json({ error: 'Valid noteId required' }, { status: 400 })

    await prisma.studentNote.delete({ where: { id: Number(noteId) } })
    return Response.json({ success: true })
  } catch (e: any) {
    if (e?.code === 'P2025') return Response.json({ error: 'Note not found' }, { status: 404 })
    console.error('[DELETE /api/students/[id]/notes]', e)
    return Response.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
