import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import EstimateSheet from '@/components/estimate/estimate-sheet'
import ComplianceSummary from '@/components/estimate/compliance-summary'
import ActualsForm from '@/components/estimate/actuals-form'
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
      accessType: zone.accessType,
      loadingClass: zone.loadingClass,
      heightM: zone.heightM,
      perimeterM: zone.perimeterM,
      areaM2: zone.areaM2,
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

  const jobPhases = await prisma.phase.findMany({ where: { jobId } })
  const actualsRows = job.drawings.flatMap((drawing) =>
    drawing.zones.map((zone) => {
      const tubeQty = zone.estimateItems
        .filter((i) => i.category === 'material' && (i.unit === 'lm' || i.description.toLowerCase().includes('tube')))
        .reduce((sum, i) => sum + i.quantity, 0)
      const phasesForStructure = jobPhases.filter((ph) => ph.structureId === drawing.structureId)
      const plannedStart = phasesForStructure.find((ph) => ph.type === 'erect')?.startDate ?? job.startDate
      const plannedEnd = phasesForStructure.find((ph) => ph.type === 'dismantle')?.endDate ?? new Date(new Date(job.startDate).getTime() + job.durationWeeks * 7 * 86400000)
      return {
        zoneId: `${drawing.id}:${zone.id}`,
        label: zone.label,
        structureName: drawing.structureName,
        estimatedQty: Math.round(tubeQty * 10) / 10,
        actualQty: zone.actualQty,
        plannedStart: new Date(plannedStart).toISOString(),
        plannedEnd: new Date(plannedEnd).toISOString(),
        actualStart: zone.actualStart ? zone.actualStart.toISOString().slice(0, 10) : null,
        actualEnd: zone.actualEnd ? zone.actualEnd.toISOString().slice(0, 10) : null,
      }
    })
  )

  const allZonesForCompliance = structures.flatMap((s) =>
    s.zones.map((z) => ({
      id: z.id,
      label: z.label,
      scaffoldType: z.scaffoldType,
      accessType: z.accessType,
      loadingClass: z.loadingClass,
      heightM: z.heightM,
      perimeterM: z.perimeterM,
      areaM2: z.areaM2,
    }))
  )

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
            nativeButton={false}
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
            nativeButton={false}
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
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {allZonesForCompliance.length > 0 && <ComplianceSummary zones={allZonesForCompliance} />}
        {actualsRows.length > 0 && <ActualsForm zones={actualsRows} jobId={jobId} />}
        <EstimateSheet
          jobId={jobId}
          title={`${job.projectNumber} — ${job.title}`}
          structures={structures}
        />
      </div>
    </div>
  )
}
