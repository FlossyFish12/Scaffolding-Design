import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import EstimateSheet from '@/components/estimate/estimate-sheet'

type Params = { params: Promise<{ jobId: string }> }

export default async function EstimatePage({ params }: Params) {
  const { jobId } = await params
  let job
  try {
    job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        drawings: {
          include: {
            zones: {
              include: {
                estimateItems: {
                  orderBy: [{ category: 'asc' }, { description: 'asc' }],
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { structureId: 'asc' },
        },
      },
    })
  } catch {
    job = null
  }
  if (!job) notFound()

  const structures = job.drawings.map((drawing) => ({
    structureId: drawing.structureId,
    structureName: drawing.structureName,
    drawingId: drawing.id,
    zones: drawing.zones.map((zone) => ({
      id: zone.id,
      label: zone.label,
      scaffoldType: zone.scaffoldType,
      items: zone.estimateItems.map((item) => ({
        id: item.id,
        category: item.category as 'material' | 'labour',
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitManhours: item.unitManhours,
        overridden: item.overridden,
        zoneId: zone.id,
        drawingId: drawing.id,
        jobId,
      })),
    })),
  }))

  return (
    <EstimateSheet
      jobId={jobId}
      title={`${job.projectNumber} — ${job.title}`}
      structures={structures}
    />
  )
}
