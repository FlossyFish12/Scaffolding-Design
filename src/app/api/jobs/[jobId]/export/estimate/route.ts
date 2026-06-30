import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/db'
import { buildEstimateWorkbook, type EstimateJobData } from '@/lib/export-excel-utils'

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
    },
  })

  if (!job) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const jobData: EstimateJobData = {
    projectNumber: job.projectNumber,
    title: job.title,
    drawings: job.drawings.map((d) => ({
      structureId: d.structureId,
      structureName: d.structureName,
      zones: d.zones.map((z) => ({
        label: z.label,
        scaffoldType: z.scaffoldType,
        estimateItems: z.estimateItems.map((i) => ({
          category: i.category as 'material' | 'labour',
          description: i.description,
          quantity: i.quantity,
          unit: i.unit,
          unitManhours: i.unitManhours,
        })),
      })),
    })),
  }

  const wb = buildEstimateWorkbook(jobData)
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${job.projectNumber}-estimate.xlsx"`,
    },
  })
}
