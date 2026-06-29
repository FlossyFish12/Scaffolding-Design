import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { generateEstimateItems } from '@/lib/estimate-engine'

type Params = { params: Promise<{ jobId: string; drawingId: string; zoneId: string }> }

const GenerateSchema = z.object({
  templateId: z.string().optional(),
})

export async function POST(req: Request, { params }: Params) {
  const { zoneId } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = GenerateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const zone = await prisma.zone.findUnique({
      where: { id: zoneId },
      include: { estimateItems: true },
    })
    if (!zone) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let template = null
    if (parsed.data.templateId) {
      template = await prisma.template.findUnique({
        where: { id: parsed.data.templateId },
        include: { lineItems: true },
      })
      if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    } else {
      template = await prisma.template.findFirst({
        where: {
          scaffoldType: zone.scaffoldType,
          accessTypes: { has: zone.accessType },
          loadingClasses: { has: zone.loadingClass },
        },
        include: { lineItems: true },
      })
    }
    if (!template) {
      return NextResponse.json({ error: 'No matching template found' }, { status: 422 })
    }

    const newItems = generateEstimateItems(
      template.lineItems.map((li) => ({
        category: li.category as 'material' | 'labour',
        description: li.description,
        formula: li.formula,
        unit: li.unit,
      })),
      { heightM: zone.heightM, perimeterM: zone.perimeterM, areaM2: zone.areaM2 },
    )

    // Keys of existing overridden items — we skip re-generating these
    const overriddenKeys = new Set(
      zone.estimateItems
        .filter((i) => i.overridden)
        .map((i) => `${i.category}:${i.description}`),
    )

    await prisma.estimateItem.deleteMany({ where: { zoneId, overridden: false } })

    const toCreate = newItems.filter(
      (i) => !overriddenKeys.has(`${i.category}:${i.description}`),
    )
    await prisma.estimateItem.createMany({
      data: toCreate.map((i) => ({ ...i, zoneId })),
    })

    await prisma.zone.update({ where: { id: zoneId }, data: { templateId: template.id } })

    const allItems = await prisma.estimateItem.findMany({
      where: { zoneId },
      orderBy: [{ category: 'asc' }, { description: 'asc' }],
    })
    return NextResponse.json(allItems)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
