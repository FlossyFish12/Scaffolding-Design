import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { buildEstimateWorkbook } from '../export-excel-utils'

const mockJob = {
  projectNumber: 'PRJ-2024-001',
  title: 'Test Job',
  drawings: [
    {
      structureId: 'STR-01',
      structureName: 'Main Structure',
      zones: [
        {
          label: 'Zone A',
          scaffoldType: 'independent',
          estimateItems: [
            { category: 'labour' as const, description: 'Erect & dismantle', quantity: 10, unit: 'hrs', unitManhours: 1.5 },
            { category: 'material' as const, description: 'Tube 48.3mm', quantity: 50, unit: 'm', unitManhours: 0 },
          ],
        },
      ],
    },
  ],
}

describe('buildEstimateWorkbook', () => {
  it('has a Summary sheet and one sheet per structure', () => {
    const wb = buildEstimateWorkbook(mockJob)
    expect(wb.SheetNames).toContain('Summary')
    expect(wb.SheetNames).toContain('STR-01')
    expect(wb.SheetNames).toHaveLength(2)
  })

  it('summary sheet includes structure id and manhours total', () => {
    const wb = buildEstimateWorkbook(mockJob)
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Summary'], { header: 1 }) as unknown[][]
    const flat = rows.flat()
    expect(flat).toContain('STR-01')
    expect(flat).toContain(15) // 10 * 1.5 = 15
  })

  it('structure sheet contains zone label and item description', () => {
    const wb = buildEstimateWorkbook(mockJob)
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['STR-01'], { header: 1 }) as unknown[][]
    const flat = rows.flat().filter(Boolean)
    const text = flat.join(' ')
    expect(text).toContain('Zone A')
    expect(text).toContain('Erect & dismantle')
    expect(text).toContain('Tube 48.3mm')
  })

  it('labour rows have an Excel formula in the Total hrs column', () => {
    const wb = buildEstimateWorkbook(mockJob)
    const ws = wb.Sheets['STR-01']
    const formulaCells = Object.values(ws).filter(
      (c): c is XLSX.CellObject => typeof c === 'object' && c !== null && 'f' in c
    )
    expect(formulaCells.length).toBeGreaterThan(0)
    expect(formulaCells[0].f).toMatch(/B\d+\*D\d+/)
  })

  it('handles job with no drawings without throwing', () => {
    const wb = buildEstimateWorkbook({ projectNumber: 'P-000', title: 'Empty', drawings: [] })
    expect(wb.SheetNames).toEqual(['Summary'])
  })
})
