import { prisma } from '@/lib/db'
import GanttChart, { type GanttJob, type PhaseRow, type StructureRow } from '@/components/schedule/gantt-chart'
import MaterialSCurve from '@/components/schedule/material-s-curve'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function SchedulePage() {
  let ganttJobs: GanttJob[] = []
  let sCurveZones: { zoneId: string; label: string; structureId: string; quantityTubeM: number; erectStart: string; dismantleEnd: string }[] = []
  try {
    const jobs = await prisma.job.findMany({
      include: {
        drawings: {
          include: {
            zones: {
              include: {
                estimateItems: true,
              },
            },
          },
          orderBy: { structureId: 'asc' },
        },
        phases: { orderBy: { startDate: 'asc' } },
      },
      orderBy: { startDate: 'asc' },
    })

    ganttJobs = jobs.map((job) => {
      const structures: StructureRow[] = job.drawings.map((drawing) => {
        const structureManhours = drawing.zones
          .flatMap((z) => z.estimateItems)
          .reduce((sum, i) => sum + i.quantity * i.unitManhours, 0)

        const phases: PhaseRow[] = job.phases
          .filter((p) => p.structureId === drawing.structureId)
          .map((p) => ({
            id: p.id,
            jobId: job.id,
            type: p.type as 'erect' | 'modify' | 'dismantle',
            structureId: p.structureId,
            startDate: p.startDate.toISOString(),
            endDate: p.endDate.toISOString(),
            manhoursTotal: structureManhours,
          }))

        return {
          structureId: drawing.structureId,
          structureName: drawing.structureName,
          drawingId: drawing.id,
          phases,
        }
      })

      return {
        jobId: job.id,
        title: job.title,
        projectNumber: job.projectNumber,
        structures,
      }
    })

    // Build S-curve zones: tube meters per zone, erect→dismantle window
    sCurveZones = jobs.flatMap(job =>
      job.drawings.flatMap(drawing => {
        const phasesForStructure = job.phases.filter(p => p.structureId === drawing.structureId)
        const erectStart = phasesForStructure.find(p => p.type === 'erect')?.startDate ?? job.startDate
        const dismantleEnd = phasesForStructure.find(p => p.type === 'dismantle')?.endDate ?? new Date(new Date(job.startDate).getTime() + job.durationWeeks * 7 * 86400000)
        return drawing.zones.map(zone => {
          const tubeQty = zone.estimateItems
            .filter(i => i.category === 'material' && (i.unit === 'lm' || i.description.toLowerCase().includes('tube')))
            .reduce((sum, i) => sum + i.quantity, 0)
          const qty = tubeQty > 0 ? tubeQty : zone.estimateItems.filter(i => i.category === 'material').reduce((s,i)=>s+i.quantity,0) / 3 // fallback
          return {
            zoneId: zone.id,
            label: `${drawing.structureName} — ${zone.label}`,
            structureId: drawing.structureId,
            quantityTubeM: Math.round(qty * 10) / 10,
            erectStart: new Date(erectStart).toISOString(),
            dismantleEnd: new Date(dismantleEnd).toISOString(),
          }
        })
      })
    ).filter(z => z.quantityTubeM > 0)
  } catch (e) {
    console.error('[SchedulePage] failed to load data:', e)
    ganttJobs = []
    sCurveZones = []
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--background)' }}>
      <div
        className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0"
        style={{ background: 'var(--card)' }}
      >
        <h1 className="text-xl font-semibold">Level 4 Schedule</h1>
        <div className="flex gap-2">
          <Button
            nativeButton={false}
            render={<a href="/api/export/schedule" download />}
            style={{ fontSize: 12, padding: '4px 12px' }}
          >
            Export Schedule
          </Button>
          <Button nativeButton={false} render={<Link href="/resources" />}
            style={{ fontSize: 12, padding: '4px 12px' }}>
            Resource View
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <GanttChart jobs={ganttJobs} />
        {sCurveZones.length > 0 ? (
          <MaterialSCurve zones={sCurveZones} />
        ) : (
          <div className="text-xs text-muted-foreground border rounded p-3">
            No material for S-curve yet — create zones and generate estimates (tube meters) to see when material frees.
          </div>
        )}
      </div>
    </div>
  )
}
