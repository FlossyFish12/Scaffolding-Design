import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const zoneSchema = z.object({
  pageNumber: z.number().int().min(1).default(1),
  label: z.string().min(1),
  canvasData: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  }),
  accessType: z.enum(['ground', 'elevated', 'confined', 'overhead']),
  loadingClass: z.enum(['light', 'medium', 'heavy']),
  heightM: z.number().positive(),
  perimeterM: z.number().positive(),
  areaM2: z.number().positive(),
  bayLengthM: z.number().positive().default(2.1),
  liftHeightM: z.number().positive().default(2.0),
  boards: z.number().int().min(3).max(5).default(4),
  scaffoldType: z.enum(['independent', 'birdcage', 'putlog', 'suspended', 'cantilever']),
  templateId: z.string().nullable().optional(),
})

type Params = { params: Promise<{ jobId: string; drawingId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { drawingId } = await params
    const drawing = await prisma.drawing.findUnique({ where: { id: drawingId }, select: { id: true } })
    if (!drawing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const zones = await prisma.zone.findMany({ where: { drawingId }, orderBy: { createdAt: 'asc' } })
    return NextResponse.json(zones)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { drawingId } = await params
    const drawing = await prisma.drawing.findUnique({ where: { id: drawingId }, select: { id: true } })
    if (!drawing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const result = zoneSchema.safeParse(body)
    if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
    const zone = await prisma.zone.create({ data: { drawingId, ...result.data } })
    return NextResponse.json(zone, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
