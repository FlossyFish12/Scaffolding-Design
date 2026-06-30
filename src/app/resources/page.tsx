import { prisma } from '@/lib/db'
import ResourceHistogram from '@/components/schedule/resource-histogram'
import type { GanttJob } from '@/components/schedule/gantt-chart'
import { weeksInRange } from '@/lib/schedule-utils'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function ResourcesPage() {
  let ganttJobs: GanttJob[] = []
  let poolEntries: { id: string; weekStartDate: string; availableManhours: number }[] = []
  let weeks: Date[] = []
  let loadError = false

  try {
    const jobs = await prisma.job.findMany({
      include: {
        drawings: {
          include: {
            zones: {
              include: { estimateItems: { where: { category: 'labour' } } },
            },
          },
          orderBy: { structureId: 'asc' },
        },
        phases: { orderBy: { startDate: 'asc' } },
      },
      orderBy: { startDate: 'asc' },
    })

    ganttJobs = jobs.map((job) => ({
      jobId: job.id,
      title: job.title,
      projectNumber: job.projectNumber,
      structures: job.drawings.map((drawing) => {
        const structureManhours = drawing.zones
          .flatMap((z) => z.estimateItems)
          .reduce((sum, i) => sum + i.quantity * i.unitManhours, 0)

        return {
          structureId: drawing.structureId,
          structureName: drawing.structureName,
          drawingId: drawing.id,
          phases: job.phases
            .filter((p) => p.structureId === drawing.structureId)
            .map((p) => ({
              id: p.id,
              jobId: job.id,
              type: p.type as 'erect' | 'modify' | 'dismantle',
              structureId: p.structureId,
              startDate: p.startDate.toISOString(),
              endDate: p.endDate.toISOString(),
              manhoursTotal: structureManhours,
            })),
        }
      }),
    }))

    // Determine week range: span of all phases, or next 12 weeks if no phases
    const allPhases = ganttJobs.flatMap(j => j.structures.flatMap(s => s.phases))
    const now = new Date()
    const rangeStart = allPhases.length > 0
      ? new Date(Math.min(...allPhases.map(p => new Date(p.startDate).getTime())))
      : now
    const rangeEnd = allPhases.length > 0
      ? new Date(Math.max(...allPhases.map(p => new Date(p.endDate).getTime())))
      : new Date(now.getTime() + 12 * 7 * 24 * 60 * 60 * 1000)

    weeks = weeksInRange(rangeStart, rangeEnd)

    const poolRaw = await prisma.resourcePool.findMany({
      where: {
        weekStartDate: {
          gte: weeks[0],
          lte: weeks[weeks.length - 1],
        },
      },
      orderBy: { weekStartDate: 'asc' },
    })
    poolEntries = poolRaw.map(e => ({
      id: e.id,
      weekStartDate: e.weekStartDate.toISOString(),
      availableManhours: e.availableManhours,
    }))
  } catch (e) {
    console.error('[ResourcesPage] failed to load data:', e)
    ganttJobs = []
    weeks = []
    poolEntries = []
    loadError = true
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--background)' }}>
      <div
        className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0"
        style={{ background: 'var(--card)' }}
      >
        <h1 className="text-xl font-semibold">Resource View</h1>
        <Button nativeButton={false} render={<Link href="/schedule" />}
          style={{ fontSize: 12, padding: '4px 12px' }}>
          Gantt Schedule
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        {loadError ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Could not load schedule data. Please try again later.
          </div>
        ) : weeks.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No phases found. Add phases in the Schedule view first.
          </div>
        ) : (
          <ResourceHistogram jobs={ganttJobs} weeks={weeks} initialPool={poolEntries} />
        )}
      </div>
    </div>
  )
}
