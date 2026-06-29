import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/db'

type Params = { params: Promise<{ jobId: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { jobId } = await params
  const drawings = await prisma.drawing.findMany({
    where: { jobId },
    orderBy: { structureId: 'asc' },
  })
  return NextResponse.json(drawings)
}

export async function POST(request: Request, { params }: Params) {
  const { jobId } = await params
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const structureId = formData.get('structureId') as string | null
  const structureName = formData.get('structureName') as string | null

  if (!file || !structureId || !structureName) {
    return NextResponse.json({ error: 'file, structureId, and structureName are required' }, { status: 400 })
  }

  const blob = await put(`drawings/${jobId}/${file.name}`, file, { access: 'public' })

  const drawing = await prisma.drawing.create({
    data: { jobId, structureId, structureName, filename: file.name, blobUrl: blob.url },
  })

  return NextResponse.json(drawing, { status: 201 })
}
