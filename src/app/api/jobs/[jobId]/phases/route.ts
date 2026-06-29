import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

const PhaseCreateSchema = z.object({
  type: z.enum(['erect', 'modify', 'dismantle']),
  structureId: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
})

type Params = { params: Promise<{ jobId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { jobId } = await params
    const job = await prisma.job.findUnique({ where: { id: jobId } })
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const phases = await prisma.phase.findMany({
      where: { jobId },
      orderBy: { startDate: 'asc' },
    })
    return NextResponse.json(phases)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: Params) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = PhaseCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const { jobId } = await params
    const job = await prisma.job.findUnique({ where: { id: jobId } })
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const phase = await prisma.phase.create({
      data: {
        jobId,
        type: parsed.data.type,
        structureId: parsed.data.structureId,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
      },
    })
    return NextResponse.json(phase, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
