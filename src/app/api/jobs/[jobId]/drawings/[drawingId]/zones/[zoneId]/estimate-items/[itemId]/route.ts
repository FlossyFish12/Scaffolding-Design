import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

type Params = { params: Promise<{ jobId: string; drawingId: string; zoneId: string; itemId: string }> }

const EstimateItemPatchSchema = z
  .object({
    quantity: z.number().min(0).optional(),
    unitManhours: z.number().min(0).optional(),
  })
  .refine((d) => d.quantity !== undefined || d.unitManhours !== undefined, {
    message: 'At least one of quantity or unitManhours must be provided',
  })

export async function PATCH(req: Request, { params }: Params) {
  const { itemId } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = EstimateItemPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const item = await prisma.estimateItem.update({
      where: { id: itemId },
      data: { ...parsed.data, overridden: true },
    })
    return NextResponse.json(item)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
