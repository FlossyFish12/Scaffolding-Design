import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

const TemplateCreateSchema = z.object({
  name: z.string().min(1),
  scaffoldType: z.enum(['independent', 'birdcage', 'putlog', 'suspended', 'cantilever']),
  accessTypes: z.array(z.enum(['ground', 'elevated', 'confined', 'overhead'])).min(1),
  loadingClasses: z.array(z.enum(['light', 'medium', 'heavy'])).min(1),
})

export async function GET() {
  try {
    const templates = await prisma.template.findMany({
      include: { _count: { select: { lineItems: true } } },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(templates)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = TemplateCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const template = await prisma.template.create({
      data: {
        name: parsed.data.name,
        scaffoldType: parsed.data.scaffoldType,
        accessTypes: JSON.stringify(parsed.data.accessTypes),
        loadingClasses: JSON.stringify(parsed.data.loadingClasses),
      },
    })
    return NextResponse.json(template, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
