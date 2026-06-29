import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

const PutSchema = z.object({
  weekStartDate: z.string().datetime(),
  availableManhours: z.number().min(0),
})

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    if (!from || !to) {
      return NextResponse.json({ error: 'from and to query params required' }, { status: 400 })
    }
    const entries = await prisma.resourcePool.findMany({
      where: {
        weekStartDate: {
          gte: new Date(from),
          lte: new Date(to),
        },
      },
      orderBy: { weekStartDate: 'asc' },
    })
    return NextResponse.json(entries)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = PutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const weekDate = new Date(parsed.data.weekStartDate)
    const entry = await prisma.resourcePool.upsert({
      where: { weekStartDate: weekDate },
      update: { availableManhours: parsed.data.availableManhours },
      create: { weekStartDate: weekDate, availableManhours: parsed.data.availableManhours },
    })
    return NextResponse.json(entry)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
