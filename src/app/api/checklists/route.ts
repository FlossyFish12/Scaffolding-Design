import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const UpsertSchema = z.object({
  scope: z.string().min(1),
  inspector: z.string().default(''),
  date: z.string().optional(),
  items: z.string(), // JSON array
})

export async function GET(req: Request) {
  const scope = new URL(req.url).searchParams.get('scope')
  try {
    if (scope) {
      const cl = await prisma.checklist.findUnique({ where: { scope } })
      return NextResponse.json(cl ?? null)
    }
    return NextResponse.json(await prisma.checklist.findMany())
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const parsed = UpsertSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    const { scope, inspector, items } = parsed.data
    const date = parsed.data.date ? new Date(parsed.data.date) : new Date()
    const cl = await prisma.checklist.upsert({
      where: { scope },
      update: { inspector, items, date },
      create: { scope, inspector, items, date },
    })
    return NextResponse.json(cl)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
