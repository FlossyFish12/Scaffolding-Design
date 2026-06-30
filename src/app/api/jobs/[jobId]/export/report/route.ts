import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { prisma } from '@/lib/db'
import { EstimateReport, type EstimateReportProps, type ReportStructure } from '@/components/export/estimate-pdf'
import { computeWeeklyDemand } from '@/lib/resource-histogram-utils'
import { weeksInRange } from '@/lib/schedule-utils'
import type { GanttJob } from '@/components/schedule/gantt-chart'
import React from 'react'

type Params = { params: Promise<{ jobId: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { jobId } = await params

  const job = await prisma.job.findUnique({
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
      phases: { orderBy: { startDate: 'asc' } },
    },
  })

  if (!job) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Build structures for PDF
  const structures: ReportStructure[] = job.drawings.map((drawing) => {
    const zones = drawing.zones.map((zone) => {
      const labourItems = zone.estimateItems
        .filter((i) => i.category === 'labour')
        .map((i) => ({ description: i.description, quantity: i.quantity, unit: i.unit, unitManhours: i.unitManhours }))

      const materialItems = zone.estimateItems
        .filter((i) => i.category === 'material')
        .map((i) => ({ description: i.description, quantity: i.quantity, unit: i.unit }))

      const zoneManhours = labourItems.reduce((sum, i) => sum + i.quantity * i.unitManhours, 0)
      return { label: zone.label, scaffoldType: zone.scaffoldType, labourItems, materialItems, zoneManhours }
    })

    const structureManhours = zones.reduce((sum, z) => sum + z.zoneManhours, 0)
    return { structureId: drawing.structureId, structureName: drawing.structureName, zones, structureManhours }
  })

  const totalManhours = structures.reduce((sum, s) => sum + s.structureManhours, 0)

  // Compute peak weekly demand for this job using existing utility
  const ganttJob: GanttJob = {
    jobId: job.id,
    title: job.title,
    projectNumber: job.projectNumber,
    structures: job.drawings.map((d) => ({
      structureId: d.structureId,
      structureName: d.structureName,
      drawingId: d.id,
      phases: job.phases
        .filter((p) => p.structureId === d.structureId)
        .map((p) => ({
          id: p.id,
          jobId: job.id,
          type: p.type as 'erect' | 'modify' | 'dismantle',
          structureId: p.structureId,
          startDate: p.startDate.toISOString(),
          endDate: p.endDate.toISOString(),
          manhoursTotal: structures.find((s) => s.structureId === d.structureId)?.structureManhours ?? 0,
        })),
    })),
  }

  let peakWeeklyDemand = 0
  let durationWeeks = 0
  if (job.phases.length > 0) {
    const rangeStart = new Date(Math.min(...job.phases.map((p) => p.startDate.getTime())))
    const rangeEnd = new Date(Math.max(...job.phases.map((p) => p.endDate.getTime())))
    durationWeeks = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (7 * 24 * 60 * 60 * 1000))
    const weeks = weeksInRange(rangeStart, rangeEnd)
    const demand = computeWeeklyDemand([ganttJob], weeks)
    peakWeeklyDemand = Math.max(...demand.map((d) => d.totalManhours))
  }

  // Aggregate material quantities by description across all zones/structures
  const matTotals = new Map<string, { quantity: number; unit: string }>()
  for (const struct of structures) {
    for (const zone of struct.zones) {
      for (const mat of zone.materialItems) {
        const existing = matTotals.get(mat.description)
        if (existing) {
          existing.quantity += mat.quantity
        } else {
          matTotals.set(mat.description, { quantity: mat.quantity, unit: mat.unit })
        }
      }
    }
  }
  const materialsByType = Array.from(matTotals.entries())
    .map(([description, { quantity, unit }]) => ({ description, quantity, unit }))
    .sort((a, b) => a.description.localeCompare(b.description))

  const date = new Date().toISOString().slice(0, 10)
  const reportProps: EstimateReportProps = {
    projectNumber: job.projectNumber,
    title: job.title,
    client: job.client,
    date,
    structures,
    totalManhours,
    durationWeeks,
    peakWeeklyDemand,
    materialsByType,
  }

  const buffer = await renderToBuffer(React.createElement(EstimateReport, reportProps))

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${job.projectNumber}-estimate.pdf"`,
    },
  })
}
