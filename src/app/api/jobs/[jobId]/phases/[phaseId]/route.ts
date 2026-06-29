import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'

const PhasePatchSchema = z
  .object({
    type: z.enum(['erect', 'modify', 'dismantle']).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  })
  .refine(
    (d) => d.type !== undefined || d.startDate !== undefined || d.endDate !== undefined,
    { message: 'At least one field required' },
  )

type Params = { params: Promise<{ jobId: string; phaseId: string }> }

export async function PATCH(request: Request, { params }: Params) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = PhasePatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const { phaseId } = await params
    const data: Record<string, unknown> = {}
    if (parsed.data.type) data.type = parsed.data.type
    if (parsed.data.startDate) data.startDate = new Date(parsed.data.startDate)
    if (parsed.data.endDate) data.endDate = new Date(parsed.data.endDate)
    const phase = await prisma.phase.update({ where: { id: phaseId }, data })
    return NextResponse.json(phase)
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { phaseId } = await params
    await prisma.phase.delete({ where: { id: phaseId } })
    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
