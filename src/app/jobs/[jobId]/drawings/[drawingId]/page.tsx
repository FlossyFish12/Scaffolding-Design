import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import DrawingEditor from '@/components/drawing-editor/drawing-editor'

export default async function DrawingEditorPage({
  params,
}: {
  params: Promise<{ jobId: string; drawingId: string }>
}) {
  const { drawingId } = await params

  let drawing
  let zones: Awaited<ReturnType<typeof prisma.zone.findMany>> = []
  try {
    drawing = await prisma.drawing.findUnique({ where: { id: drawingId } })
    if (drawing) {
      zones = await prisma.zone.findMany({
        where: { drawingId },
        orderBy: { createdAt: 'asc' },
      })
    }
  } catch {
    // DB not yet connected — show empty editor
  }

  if (!drawing) notFound()

  const drawingData = {
    id: drawing.id,
    jobId: drawing.jobId,
    structureId: drawing.structureId,
    structureName: drawing.structureName,
    filename: drawing.filename,
    blobUrl: drawing.blobUrl,
    pageCount: drawing.pageCount,
  }

  const zonesData = zones.map((z) => ({
    id: z.id,
    drawingId: z.drawingId,
    pageNumber: z.pageNumber,
    label: z.label,
    canvasData: z.canvasData as { x: number; y: number; width: number; height: number },
    accessType: z.accessType,
    loadingClass: z.loadingClass,
    heightM: z.heightM,
    perimeterM: z.perimeterM,
    areaM2: z.areaM2,
    scaffoldType: z.scaffoldType,
    templateId: z.templateId,
    createdAt: z.createdAt.toISOString(),
  }))

  return <DrawingEditor drawing={drawingData} initialZones={zonesData} />
}
