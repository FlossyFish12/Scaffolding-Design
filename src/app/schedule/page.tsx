import { prisma } from '@/lib/db'
import GanttChart, { type GanttJob, type PhaseRow, type StructureRow } from '@/components/schedule/gantt-chart'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function SchedulePage() {
  let ganttJobs: GanttJob[] = []
  try {
    const jobs = await prisma.job.findMany({
      include: {
        drawings: {
          include: {
            zones: {
              include: {
                estimateItems: { where: { category: 'labour' } },
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
  } catch (e) {
    console.error('[SchedulePage] failed to load data:', e)
    ganttJobs = []
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
      <div className="flex-1 overflow-auto">
        <GanttChart jobs={ganttJobs} />
      </div>
    </div>
  )
}
