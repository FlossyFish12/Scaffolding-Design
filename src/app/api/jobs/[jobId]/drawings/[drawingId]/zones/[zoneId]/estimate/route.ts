import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { generateEstimateItems } from '@/lib/estimate-engine'
import { calculateMto } from '@/lib/calc/mto'

type Params = { params: Promise<{ jobId: string; drawingId: string; zoneId: string }> }

const GenerateSchema = z.object({
  templateId: z.string().optional(),
})

export async function POST(req: Request, { params }: Params) {
  const { jobId, drawingId, zoneId } = await params
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
      const candidates = await prisma.template.findMany({
        where: { scaffoldType: zone.scaffoldType },
        include: { lineItems: true },
      })
      template =
        candidates.find((t) => {
          try {
            const ats = JSON.parse(t.accessTypes || '[]')
            const lcs = JSON.parse(t.loadingClasses || '[]')
            return ats.includes(zone.accessType) && lcs.includes(zone.loadingClass)
          } catch {
            return false
          }
        }) ?? null
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

    // ── MTO sync: derive MTO from zone dimensions (with 10% waste) ──
    const loadClassMap: Record<string, number> = { light: 2, medium: 3, heavy: 4 }
    const bayLengthM = 2.1
    const liftHeightM = 2.0
    const boards = 4
    const numBays = Math.max(1, Math.round((zone.perimeterM || 10) / bayLengthM))
    const mtoParams = {
      height_m: zone.heightM || 6,
      bay_length_m: bayLengthM,
      lift_height_m: liftHeightM,
      boards,
      num_bays: numBays,
      load_class: loadClassMap[zone.loadingClass] ?? 2,
      wind_zone: 2,
      tie_pattern: 'alternate' as const,
      ground_bearing_kpa: 50,
      job_ref: zone.label || 'ZONE-MTO',
    }
    let mtoItems: typeof newItems = []
    try {
      const mto = calculateMto(mtoParams as any)
      mtoItems = mto.items.map((it) => ({
        category: 'material' as const,
        description: `[MTO] ${it.item}`,
        quantity: Math.round(it.qty * 1.1 * 100) / 100,
        unit: it.unit,
        unitManhours: 0,
      }))
    } catch {
      // MTO calc failed — skip
    }
    // Merge template + MTO (MTO respects same overridden guard)
    const mergedNewItems = [...newItems, ...mtoItems]

    // Keys of existing overridden items — we skip re-generating these
    const overriddenKeys = new Set(
      zone.estimateItems
        .filter((i) => i.overridden)
        .map((i) => `${i.category}:${i.description}`),
    )

    const toCreate = mergedNewItems.filter(
      (i) => !overriddenKeys.has(`${i.category}:${i.description}`),
    )

    const allItems = await prisma.$transaction(async (tx) => {
      await tx.estimateItem.deleteMany({ where: { zoneId, overridden: false } })
      await tx.estimateItem.createMany({ data: toCreate.map((i) => ({ ...i, zoneId })) })
      await tx.zone.update({ where: { id: zoneId }, data: { templateId: template.id } })
      return tx.estimateItem.findMany({
        where: { zoneId },
        orderBy: [{ category: 'asc' }, { description: 'asc' }],
      })
    })

    // ── Material register: allocate MTO items to weeks (erect→dismantle) ──
    try {
      const ITEM_KEY_MAP: Array<[RegExp, string]> = [
        [/standards/i, 'tube48'],
        [/ledgers/i, 'tube48'],
        [/transoms/i, 'tube48'],
        [/brace/i, 'tube48'],
        [/tube/i, 'tube48'],
        [/boards?\s*\(225mm\)/i, 'board'],
        [/sole/i, 'sole'],
        [/base plate/i, 'base'],
        [/right-angle/i, 'coupler-rac'],
        [/swivel/i, 'coupler-swivel'],
        [/tie/i, 'tie'],
      ]
      const drawingRow = await prisma.drawing.findUnique({ where: { id: drawingId }, select: { structureId: true } })
      const phases = await prisma.phase.findMany({ where: { jobId, structureId: drawingRow?.structureId ?? '' } })
      const weekFrom = phases.find((ph) => ph.type === 'erect')?.startDate
        ?? new Date(new Date().toISOString().slice(0, 10))
      const weekTo = phases.find((ph) => ph.type === 'dismantle')?.endDate
        ?? new Date(Date.now() + 8 * 7 * 86400000)
      await prisma.allocation.deleteMany({ where: { zoneId } })
      const allocs = mtoItems.map((it) => {
        const match = ITEM_KEY_MAP.find(([re]) => re.test(it.description))
        return match ? { zoneId, itemKey: match[1], qty: it.quantity, weekFrom, weekTo } : null
      }).filter((a): a is NonNullable<typeof a> => a !== null)
      if (allocs.length > 0) await prisma.allocation.createMany({ data: allocs })
    } catch {
      // allocation is best-effort
    }

    // ── Phase → Resource re-calc: update manhoursTotal for phases of this structure ──
    try {
      const drawing = await prisma.drawing.findUnique({ where: { id: drawingId }, select: { structureId: true, jobId: true } })
      const targetJobId = jobId || drawing?.jobId
      const structureId = drawing?.structureId
      if (targetJobId && structureId) {
        // Sum labour quantities for all zones of this structure (via drawings)
        const zonesForStructure = await prisma.zone.findMany({
          where: { drawing: { jobId: targetJobId, structureId } },
          include: { estimateItems: { where: { category: 'labour' } } },
        })
        const labourTotal = zonesForStructure.reduce((sum, z) => sum + z.estimateItems.reduce((s, it) => s + it.quantity * (it.unitManhours || 1), 0), 0)
        if (labourTotal > 0) {
          const phases = await prisma.phase.findMany({ where: { jobId: targetJobId, structureId } })
          if (phases.length > 0) {
            // Distribute equally if multiple phases, else assign to single
            const perPhase = Math.round((labourTotal / phases.length) * 100) / 100
            await Promise.all(phases.map((p) => prisma.phase.update({ where: { id: p.id }, data: { manhoursTotal: perPhase } })))
          }
        }
      }
    } catch {
      // phase update is best-effort
    }

    return NextResponse.json(allItems)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
