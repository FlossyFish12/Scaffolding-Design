import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const patchSchema = z.object({
  pageNumber: z.number().int().min(1).optional(),
  label: z.string().min(1).optional(),
  canvasData: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  }).optional(),
  accessType: z.enum(['ground', 'elevated', 'confined', 'overhead']).optional(),
  loadingClass: z.enum(['light', 'medium', 'heavy']).optional(),
  heightM: z.number().positive().optional(),
  perimeterM: z.number().positive().optional(),
  areaM2: z.number().positive().optional(),
  scaffoldType: z.enum(['independent', 'birdcage', 'putlog', 'suspended', 'cantilever']).optional(),
  templateId: z.string().nullable().optional(),
})

type Params = { params: Promise<{ jobId: string; drawingId: string; zoneId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { zoneId } = await params
    const zone = await prisma.zone.findUnique({ where: { id: zoneId }, include: { estimateItems: true } })
    if (!zone) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(zone)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { zoneId } = await params
    const body = await request.json()
    const result = patchSchema.safeParse(body)
    if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
    try {
      const zone = await prisma.zone.update({ where: { id: zoneId }, data: result.data })
      return NextResponse.json(zone)
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
      throw e
    }
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { zoneId } = await params
    try {
      await prisma.zone.delete({ where: { id: zoneId } })
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
      throw e
    }
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
