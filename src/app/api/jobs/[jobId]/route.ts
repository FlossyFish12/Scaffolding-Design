import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const updateJobSchema = z.object({
  title: z.string().min(1).optional(),
  client: z.string().min(1).optional(),
  status: z.enum(['draft', 'estimated', 'approved']).optional(),
  startDate: z.string().datetime().optional(),
  durationWeeks: z.number().int().positive().optional(),
})

type Params = { params: Promise<{ jobId: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { jobId } = await params
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      drawings: { orderBy: { structureId: 'asc' } },
      phases: { orderBy: { startDate: 'asc' } },
    },
  })
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(job)
}

export async function PATCH(request: Request, { params }: Params) {
  const { jobId } = await params
  const body = await request.json()
  const result = updateJobSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }
  const data = {
    ...result.data,
    ...(result.data.startDate ? { startDate: new Date(result.data.startDate) } : {}),
  }
  const job = await prisma.job.update({ where: { id: jobId }, data })
  return NextResponse.json(job)
}

export async function DELETE(_req: Request, { params }: Params) {
  const { jobId } = await params
  await prisma.job.delete({ where: { id: jobId } })
  return new NextResponse(null, { status: 204 })
}
