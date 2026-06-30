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

import { buildScheduleWorkbook } from '../export-excel-utils'
import type { GanttJob } from '@/components/schedule/gantt-chart'
import type { WeeklyDemand } from '@/lib/resource-histogram-utils'

const week1 = new Date('2026-06-01T00:00:00.000Z')
const week2 = new Date('2026-06-08T00:00:00.000Z')

const mockGanttJobs: GanttJob[] = [
  {
    jobId: 'j1',
    title: 'Job Alpha',
    projectNumber: 'PRJ-001',
    structures: [
      {
        structureId: 'STR-01',
        structureName: 'Tank A',
        drawingId: 'd1',
        phases: [
          {
            id: 'p1',
            jobId: 'j1',
            type: 'erect',
            structureId: 'STR-01',
            startDate: '2026-06-01T00:00:00.000Z',
            endDate: '2026-06-14T00:00:00.000Z',
            manhoursTotal: 100,
          },
        ],
      },
    ],
  },
]

const mockDemand: WeeklyDemand[] = [
  { weekStart: week1, totalManhours: 50, byJob: { j1: 50 } },
  { weekStart: week2, totalManhours: 50, byJob: { j1: 50 } },
]

const mockCapacity = new Map([
  ['2026-06-01T00:00:00.000Z', 80],
  ['2026-06-08T00:00:00.000Z', 80],
])

describe('buildScheduleWorkbook', () => {
  it('has Phases and Weekly Demand sheets', () => {
    const wb = buildScheduleWorkbook(mockGanttJobs, [week1, week2], mockDemand, mockCapacity)
    expect(wb.SheetNames).toContain('Phases')
    expect(wb.SheetNames).toContain('Weekly Demand')
  })

  it('Phases sheet contains phase rows with project number and dates', () => {
    const wb = buildScheduleWorkbook(mockGanttJobs, [week1, week2], mockDemand, mockCapacity)
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Phases'], { header: 1 }) as unknown[][]
    const flat = rows.flat().filter(Boolean)
    expect(flat).toContain('PRJ-001')
    expect(flat).toContain('erect')
  })

  it('Weekly Demand sheet has a row per week with totalManhours', () => {
    const wb = buildScheduleWorkbook(mockGanttJobs, [week1, week2], mockDemand, mockCapacity)
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Weekly Demand'], { header: 1 }) as unknown[][]
    // Should have header row + 2 data rows
    const dataRows = rows.filter((r) => Array.isArray(r) && typeof r[1] === 'number')
    expect(dataRows).toHaveLength(2)
    expect(dataRows[0][1]).toBe(50) // total demand week 1
  })

  it('Weekly Demand sheet includes capacity column', () => {
    const wb = buildScheduleWorkbook(mockGanttJobs, [week1, week2], mockDemand, mockCapacity)
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Weekly Demand'], { header: 1 }) as unknown[][]
    const flat = rows.flat().filter(Boolean)
    expect(flat).toContain(80) // capacity value
  })
})
