import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import EstimateSheet from '@/components/estimate/estimate-sheet'
import { Button } from '@/components/ui/button'

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
    <div className="flex flex-col h-full" style={{ background: 'var(--background)' }}>
      <div
        className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0"
        style={{ background: 'var(--card)' }}
      >
        <h1 className="text-xl font-semibold">
          Estimate — {job.projectNumber}
        </h1>
        <div className="flex gap-2">
          <Button
            render={
              <a
                href={`/api/jobs/${jobId}/export/estimate`}
                download
              />
            }
            style={{ fontSize: 12, padding: '4px 12px' }}
          >
            Export Excel
          </Button>
          <Button
            render={
              <a
                href={`/api/jobs/${jobId}/export/report`}
                download
              />
            }
            style={{ fontSize: 12, padding: '4px 12px', background: 'var(--navy)', color: '#fff' }}
          >
            Export PDF
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <EstimateSheet
          jobId={jobId}
          title={`${job.projectNumber} — ${job.title}`}
          structures={structures}
        />
      </div>
    </div>
  )
}
