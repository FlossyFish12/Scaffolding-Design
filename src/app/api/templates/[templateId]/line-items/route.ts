import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

type Params = { params: Promise<{ templateId: string }> }

const LineItemCreateSchema = z.object({
  category: z.enum(['material', 'labour']),
  description: z.string().min(1),
  formula: z.string().min(1),
  unit: z.string().min(1),
})

export async function POST(req: Request, { params }: Params) {
  const { templateId } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = LineItemCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const template = await prisma.template.findUnique({ where: { id: templateId }, select: { id: true } })
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    const lineItem = await prisma.templateLineItem.create({ data: { ...parsed.data, templateId } })
    return NextResponse.json(lineItem, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
