import { NextResponse } from 'next/server'
import { putLocal as put, delLocal as del } from '@/lib/blob-local'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const uploadSchema = z.object({
  structureId: z.string().min(1),
  structureName: z.string().min(1),
})

type Params = { params: Promise<{ jobId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { jobId } = await params
    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true } })
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const drawings = await prisma.drawing.findMany({
      where: { jobId },
      orderBy: { structureId: 'asc' },
    })
    return NextResponse.json(drawings)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { jobId } = await params
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const structureId = formData.get('structureId') as string | null
    const structureName = formData.get('structureName') as string | null

    if (!file) {
      return NextResponse.json({ error: 'file, structureId, and structureName are required' }, { status: 400 })
    }

    const result = uploadSchema.safeParse({ structureId, structureName })
    if (!result.success) {
      return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 })
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File exceeds 50MB limit' }, { status: 400 })
    }

    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true } })
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const blob = await put(`drawings/${jobId}/${crypto.randomUUID()}-${file.name}`, file, { access: 'public' })

    try {
      const drawing = await prisma.drawing.create({
        data: {
          jobId,
          structureId: result.data.structureId,
          structureName: result.data.structureName,
          filename: file.name,
          blobUrl: blob.url,
        },
      })
      return NextResponse.json(drawing, { status: 201 })
    } catch {
      await del(blob.url)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
