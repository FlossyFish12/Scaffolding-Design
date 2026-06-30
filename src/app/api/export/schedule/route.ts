import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/db'
import { buildScheduleWorkbook } from '@/lib/export-excel-utils'
import { weeksInRange } from '@/lib/schedule-utils'
import { computeWeeklyDemand } from '@/lib/resource-histogram-utils'
import type { GanttJob, PhaseRow, StructureRow } from '@/components/schedule/gantt-chart'

export async function GET() {
  let ganttJobs: GanttJob[] = []
  let weeks: Date[] = []

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

        return { structureId: drawing.structureId, structureName: drawing.structureName, drawingId: drawing.id, phases }
      })

      return { jobId: job.id, title: job.title, projectNumber: job.projectNumber, structures }
    })

    const allPhases = ganttJobs.flatMap((j) => j.structures.flatMap((s) => s.phases))
    if (allPhases.length === 0) {
      return NextResponse.json({ error: 'No phases to export' }, { status: 422 })
    }

    const rangeStart = new Date(Math.min(...allPhases.map((p) => new Date(p.startDate).getTime())))
    const rangeEnd = new Date(Math.max(...allPhases.map((p) => new Date(p.endDate).getTime())))
    weeks = weeksInRange(rangeStart, rangeEnd)

    const poolRaw = await prisma.resourcePool.findMany({
      where: { weekStartDate: { gte: weeks[0], lte: weeks[weeks.length - 1] } },
    })
    const capacityMap = new Map(poolRaw.map((e) => [e.weekStartDate.toISOString(), e.availableManhours]))

    const demand = computeWeeklyDemand(ganttJobs, weeks)
    const wb = buildScheduleWorkbook(ganttJobs, weeks, demand, capacityMap)
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="schedule.xlsx"',
      },
    })
  } catch (e) {
    console.error('[schedule export] failed:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
