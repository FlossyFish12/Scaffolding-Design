import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

type Params = { params: Promise<{ templateId: string; lineItemId: string }> }

const LineItemPatchSchema = z.object({
  category: z.enum(['material', 'labour']).optional(),
  description: z.string().min(1).optional(),
  formula: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'At least one field required' })

export async function PATCH(req: Request, { params }: Params) {
  const { lineItemId } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = LineItemPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const lineItem = await prisma.templateLineItem.update({ where: { id: lineItemId }, data: parsed.data })
    return NextResponse.json(lineItem)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { lineItemId } = await params
  try {
    await prisma.templateLineItem.delete({ where: { id: lineItemId } })
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
