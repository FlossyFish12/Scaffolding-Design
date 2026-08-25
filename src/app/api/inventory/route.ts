import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const PatchSchema = z.object({
  key: z.string(),
  inStock: z.number().min(0).optional(),
  reserved: z.number().min(0).optional(),
})

const DEFAULTS = [
  { key: 'tube48', item: 'Tube 48.3mm (6m)', unit: 'No.', inStock: 500, reserved: 120, threshold: 100 },
  { key: 'board', item: 'Scaffold boards 225mm (3.9m)', unit: 'No.', inStock: 800, reserved: 240, threshold: 200 },
  { key: 'coupler-rac', item: 'Right-angle coupler', unit: 'No.', inStock: 2000, reserved: 600, threshold: 500 },
  { key: 'coupler-swivel', item: 'Swivel coupler', unit: 'No.', inStock: 800, reserved: 200, threshold: 150 },
  { key: 'base', item: 'Base plates', unit: 'No.', inStock: 300, reserved: 60, threshold: 80 },
  { key: 'sole', item: 'Sole boards', unit: 'No.', inStock: 300, reserved: 60, threshold: 80 },
  { key: 'tie', item: 'Anchor ties', unit: 'No.', inStock: 400, reserved: 90, threshold: 100 },
]

export async function GET() {
  try {
    let items = await prisma.inventoryItem.findMany({ orderBy: { key: 'asc' } })
    if (items.length === 0) {
      await prisma.inventoryItem.createMany({ data: DEFAULTS })
      items = await prisma.inventoryItem.findMany({ orderBy: { key: 'asc' } })
    }
    return NextResponse.json(items)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const parsed = PatchSchema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    const { key, ...data } = parsed.data
    const item = await prisma.inventoryItem.update({ where: { key }, data })
    return NextResponse.json(item)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
