import * as XLSX from 'xlsx'

type EstimateItem = {
  category: 'material' | 'labour'
  description: string
  quantity: number
  unit: string
  unitManhours: number
}

type ZoneData = {
  label: string
  scaffoldType: string
  estimateItems: EstimateItem[]
}

type DrawingData = {
  structureId: string
  structureName: string
  zones: ZoneData[]
}

export type EstimateJobData = {
  projectNumber: string
  title: string
  drawings: DrawingData[]
}

function structureManhours(drawing: DrawingData): number {
  return drawing.zones
    .flatMap((z) => z.estimateItems)
    .filter((i) => i.category === 'labour')
    .reduce((sum, i) => sum + i.quantity * i.unitManhours, 0)
}

function buildSummarySheet(job: EstimateJobData, date: string): XLSX.WorkSheet {
  const aoa: unknown[][] = [
    [`NMDC Energy — Estimate Report`],
    [`Project: ${job.projectNumber}`],
    [`Job: ${job.title}`],
    [`Date: ${date}`],
    [],
    ['Structure ID', 'Structure Name', 'Total Manhours'],
  ]
  let total = 0
  for (const d of job.drawings) {
    const mh = structureManhours(d)
    total += mh
    aoa.push([d.structureId, d.structureName, mh])
  }
  aoa.push([])
  aoa.push(['TOTAL', '', total])
  return XLSX.utils.aoa_to_sheet(aoa)
}

function buildStructureSheet(drawing: DrawingData, projectNumber: string, date: string): XLSX.WorkSheet {
  const aoa: unknown[][] = [
    [`${drawing.structureId} — ${drawing.structureName}`],
    [`${projectNumber} | ${date}`],
    [],
  ]

  for (const zone of drawing.zones) {
    const labour = zone.estimateItems.filter((i) => i.category === 'labour')
    const material = zone.estimateItems.filter((i) => i.category === 'material')

    aoa.push([`Zone: ${zone.label} (${zone.scaffoldType})`])

    if (labour.length > 0) {
      aoa.push(['LABOUR'])
      aoa.push(['Description', 'Quantity', 'Unit', 'Manhours/unit', 'Total hrs'])
      for (const item of labour) {
        const nextRow = aoa.length + 1 // 1-indexed xlsx row this entry will occupy
        aoa.push([
          item.description,
          item.quantity,
          item.unit,
          item.unitManhours,
          { t: 'n', f: `B${nextRow}*D${nextRow}` } as XLSX.CellObject,
        ])
      }
    }

    if (material.length > 0) {
      aoa.push(['MATERIALS'])
      aoa.push(['Description', 'Quantity', 'Unit'])
      for (const item of material) {
        aoa.push([item.description, item.quantity, item.unit])
      }
    }

    aoa.push([]) // blank row between zones
  }

  return XLSX.utils.aoa_to_sheet(aoa)
}

export function buildEstimateWorkbook(job: EstimateJobData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const date = new Date().toISOString().slice(0, 10)
  XLSX.utils.book_append_sheet(wb, buildSummarySheet(job, date), 'Summary')
  for (const drawing of job.drawings) {
    const sheetName = drawing.structureId.slice(0, 31)
    XLSX.utils.book_append_sheet(wb, buildStructureSheet(drawing, job.projectNumber, date), sheetName)
  }
  return wb
}
