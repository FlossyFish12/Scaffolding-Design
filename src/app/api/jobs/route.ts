import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createJobSchema = z.object({
  projectNumber: z.string().min(1),
  title: z.string().min(1),
  client: z.string().min(1),
  startDate: z.string().datetime(),
  durationWeeks: z.number().int().positive(),
})

export async function GET() {
  try {
    const jobs = await prisma.job.findMany({
      include: { _count: { select: { drawings: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(jobs)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = createJobSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
    }
    const job = await prisma.job.create({
      data: { ...result.data, startDate: new Date(result.data.startDate) },
    })
    return NextResponse.json(job, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
