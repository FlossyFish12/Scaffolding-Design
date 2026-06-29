import { NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { prisma } from '@/lib/db'

type Params = { params: Promise<{ jobId: string; drawingId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { drawingId } = await params
    const drawing = await prisma.drawing.findUnique({
      where: { id: drawingId },
      include: { zones: true },
    })
    if (!drawing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(drawing)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { drawingId } = await params
    const drawing = await prisma.drawing.findUnique({ where: { id: drawingId } })
    if (!drawing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await del(drawing.blobUrl)
    await prisma.drawing.delete({ where: { id: drawingId } })
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
