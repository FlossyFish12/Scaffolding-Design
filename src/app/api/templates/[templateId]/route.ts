import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

type Params = { params: Promise<{ templateId: string }> }

const TemplatePatchSchema = z.object({
  name: z.string().min(1).optional(),
  scaffoldType: z.enum(['independent', 'birdcage', 'putlog', 'suspended', 'cantilever']).optional(),
  accessTypes: z.array(z.enum(['ground', 'elevated', 'confined', 'overhead'])).min(1).optional(),
  loadingClasses: z.array(z.enum(['light', 'medium', 'heavy'])).min(1).optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'At least one field required' })

export async function GET(_req: Request, { params }: Params) {
  try {
    const { templateId } = await params
    const template = await prisma.template.findUnique({
      where: { id: templateId },
      include: { lineItems: { orderBy: { category: 'asc' } } },
    })
    if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(template)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const { templateId } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = TemplatePatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const template = await prisma.template.update({ where: { id: templateId }, data: parsed.data })
    return NextResponse.json(template)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { templateId } = await params
  try {
    await prisma.template.delete({ where: { id: templateId } })
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
