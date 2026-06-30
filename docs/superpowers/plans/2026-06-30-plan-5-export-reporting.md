# Export & Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Excel and PDF exports for estimates, per-job PDF reports, and a full Gantt/demand schedule export.

**Architecture:** Pure data-building functions in `src/lib/export-excel-utils.ts` produce `xlsx` workbooks; a `@react-pdf/renderer` React component in `src/components/export/estimate-pdf.tsx` produces PDF buffers. API routes at `/api/jobs/[jobId]/export/estimate`, `/api/jobs/[jobId]/export/report`, and `/api/export/schedule` call these functions and stream binary responses. Export buttons are added to the Estimate Sheet page and Schedule page.

**Tech Stack:** `xlsx` for workbook generation; `@react-pdf/renderer` for PDF rendering; existing Prisma queries + `computeWeeklyDemand` from `src/lib/resource-histogram-utils.ts`; `weeksInRange` from `src/lib/schedule-utils.ts`.

## Global Constraints

- Next.js 16.2.9 App Router — read `node_modules/next/dist/docs/` before writing route code.
- Dynamic params are `Promise<{...}>` — always `await params` before use.
- React 19 — use `React.JSX.Element`, not `JSX.Element`.
- Prisma v7 — `import { Prisma } from '@prisma/client'`; error type is `Prisma.PrismaClientKnownRequestError`.
- shadcn/ui v4 — `Button` uses `render` prop: `<Button render={<a href="..." download />}>Label</Button>`. No `asChild`.
- Vitest v4 — mocks use `vi.hoisted()` inside the test file. Never add global mocks to `vitest.config.ts` or `src/test/setup.ts`. `src/test/setup.ts` must stay exactly `import '@testing-library/jest-dom'`.
- NMDC brand: `--green: #00B451`, `--navy: #0D1B2A`, `--background: #F2F5F9`. Use these as PDF accent colours.
- Work on `main` branch directly — no feature branch.
- `@react-pdf/renderer` API routes are server-only — no `'use client'`.
- Sheet names in xlsx must be ≤ 31 characters — truncate `structureId` if needed: `structureId.slice(0, 31)`.
- Binary responses use plain `Response`, not `NextResponse`: `return new Response(buffer, { headers: {...} })`.
- All tests that import `@/lib/db` must mock it via `vi.mock('@/lib/db', ...)` using `vi.hoisted()`.

---

### Task 1: Install packages + Estimate Excel export

**Files:**
- Create: `src/lib/export-excel-utils.ts`
- Create: `src/lib/__tests__/export-excel-utils.test.ts`
- Create: `src/app/api/jobs/[jobId]/export/estimate/route.ts`

**Interfaces:**
- Consumes: nothing from prior tasks in this plan (new code)
- Produces:
  ```ts
  // src/lib/export-excel-utils.ts
  import * as XLSX from 'xlsx'

  type EstimateItem = {
    category: 'material' | 'labour'
    description: string
    quantity: number
    unit: string
    unitManhours: number
  }
  type ZoneData = { label: string; scaffoldType: string; estimateItems: EstimateItem[] }
  type DrawingData = { structureId: string; structureName: string; zones: ZoneData[] }
  export type EstimateJobData = { projectNumber: string; title: string; drawings: DrawingData[] }

  export function buildEstimateWorkbook(job: EstimateJobData): XLSX.WorkBook
  ```
  Tasks 2, 3, 4 rely on the route paths established here: `/api/jobs/[jobId]/export/estimate`.

- [ ] **Step 1: Install xlsx**

```bash
npm install xlsx
```

Expected output: package added to `package.json` dependencies.

- [ ] **Step 2: Write failing tests**

Create `src/lib/__tests__/export-excel-utils.test.ts`:

```ts
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
```

- [ ] **Step 3: Run tests — expect FAIL (module not found)**

```bash
npx vitest run src/lib/__tests__/export-excel-utils.test.ts
```

Expected: FAIL — `Cannot find module '../export-excel-utils'`

- [ ] **Step 4: Implement `buildEstimateWorkbook`**

Create `src/lib/export-excel-utils.ts`:

```ts
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
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
npx vitest run src/lib/__tests__/export-excel-utils.test.ts
```

Expected: 5/5 PASS

- [ ] **Step 6: Create the estimate export route**

Create `src/app/api/jobs/[jobId]/export/estimate/route.ts`:

```ts
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

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${job.projectNumber}-estimate.xlsx"`,
    },
  })
}
```

- [ ] **Step 7: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass (existing count + 5 new)

- [ ] **Step 8: Commit**

```bash
git add src/lib/export-excel-utils.ts \
        src/lib/__tests__/export-excel-utils.test.ts \
        src/app/api/jobs/[jobId]/export/estimate/route.ts \
        package.json package-lock.json
git commit -m "feat: estimate Excel export with per-structure sheets and formula cells"
```

---

### Task 2: Schedule Excel export

**Files:**
- Modify: `src/lib/export-excel-utils.ts` (add `buildScheduleWorkbook`, `GanttJobData`, `WeeklyDemandData`)
- Modify: `src/lib/__tests__/export-excel-utils.test.ts` (add schedule tests)
- Create: `src/app/api/export/schedule/route.ts`

**Interfaces:**
- Consumes:
  - `GanttJob` from `src/components/schedule/gantt-chart.tsx`
  - `WeeklyDemand` from `src/lib/resource-histogram-utils.ts`
  - `weeksInRange`, `weekLabel` from `src/lib/schedule-utils.ts`
  - `computeWeeklyDemand` from `src/lib/resource-histogram-utils.ts`
- Produces:
  ```ts
  // Added to src/lib/export-excel-utils.ts
  import type { GanttJob } from '@/components/schedule/gantt-chart'
  import type { WeeklyDemand } from '@/lib/resource-histogram-utils'

  export function buildScheduleWorkbook(
    jobs: GanttJob[],
    weeks: Date[],
    demand: WeeklyDemand[],
    capacity: Map<string, number>  // weekStartISO → availableManhours
  ): XLSX.WorkBook
  ```
  Route path: `GET /api/export/schedule` — Task 4 adds a button linking here.

- [ ] **Step 1: Add schedule tests to export-excel-utils.test.ts**

Add to the end of `src/lib/__tests__/export-excel-utils.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests — expect FAIL (buildScheduleWorkbook not exported)**

```bash
npx vitest run src/lib/__tests__/export-excel-utils.test.ts
```

Expected: FAIL — `buildScheduleWorkbook is not a function` (or similar)

- [ ] **Step 3: Implement `buildScheduleWorkbook`**

Add to the bottom of `src/lib/export-excel-utils.ts`:

```ts
import type { GanttJob } from '@/components/schedule/gantt-chart'
import type { WeeklyDemand } from '@/lib/resource-histogram-utils'
import { weekLabel } from '@/lib/schedule-utils'

export function buildScheduleWorkbook(
  jobs: GanttJob[],
  weeks: Date[],
  demand: WeeklyDemand[],
  capacity: Map<string, number>,
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const date = new Date().toISOString().slice(0, 10)

  // ── Phases sheet ──────────────────────────────────────────────────────
  const phaseAoa: unknown[][] = [
    [`Level 4 Schedule — ${date}`],
    [],
    ['Project #', 'Job Title', 'Structure ID', 'Structure Name', 'Phase Type', 'Start Date', 'End Date', 'Duration (weeks)', 'Total Manhours'],
  ]

  for (const job of jobs) {
    for (const struct of job.structures) {
      for (const phase of struct.phases) {
        const start = new Date(phase.startDate)
        const end = new Date(phase.endDate)
        const durationWeeks = Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000))
        phaseAoa.push([
          job.projectNumber,
          job.title,
          struct.structureId,
          struct.structureName,
          phase.type,
          phase.startDate.slice(0, 10),
          phase.endDate.slice(0, 10),
          durationWeeks,
          phase.manhoursTotal,
        ])
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(phaseAoa), 'Phases')

  // ── Weekly Demand sheet ───────────────────────────────────────────────
  const jobTitles = jobs.map((j) => `${j.projectNumber} — ${j.title}`)
  const demandAoa: unknown[][] = [
    [`Weekly Manhour Demand — ${date}`],
    [],
    ['Week', 'Total Demand', 'Capacity', ...jobTitles],
  ]

  for (const d of demand) {
    const iso = d.weekStart.toISOString()
    const cap = capacity.get(iso) ?? 0
    const perJob = jobs.map((j) => d.byJob[j.jobId] ?? 0)
    demandAoa.push([weekLabel(d.weekStart), d.totalManhours, cap, ...perJob])
  }

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(demandAoa), 'Weekly Demand')

  return wb
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/lib/__tests__/export-excel-utils.test.ts
```

Expected: all export-excel-utils tests PASS (5 + 4 = 9 tests)

- [ ] **Step 5: Create the schedule export route**

Create `src/app/api/export/schedule/route.ts`:

```ts
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

    return new Response(buf, {
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
```

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/lib/export-excel-utils.ts \
        src/lib/__tests__/export-excel-utils.test.ts \
        src/app/api/export/schedule/route.ts
git commit -m "feat: schedule Excel export with phases and weekly demand sheets"
```

---

### Task 3: PDF report per job

**Files:**
- Create: `src/components/export/estimate-pdf.tsx`
- Create: `src/app/api/jobs/[jobId]/export/report/route.ts`
- Create: `src/app/api/jobs/[jobId]/export/report/__tests__/route.test.ts`

**Interfaces:**
- Consumes: nothing from Tasks 1–2 in this plan; queries the same Prisma data shape as the estimate page (`src/app/jobs/[jobId]/estimate/page.tsx`)
- Produces:
  ```ts
  // src/components/export/estimate-pdf.tsx
  export type ReportStructure = {
    structureId: string
    structureName: string
    zones: Array<{
      label: string
      scaffoldType: string
      labourItems: Array<{ description: string; quantity: number; unit: string; unitManhours: number }>
      materialItems: Array<{ description: string; quantity: number; unit: string }>
      zoneManhours: number
    }>
    structureManhours: number
  }

  // materialsByType: aggregated across all zones/structures, keyed by description
  export type EstimateReportProps = {
    projectNumber: string
    title: string
    client: string
    date: string
    structures: ReportStructure[]
    totalManhours: number
    durationWeeks: number          // from earliest phase start to latest phase end
    peakWeeklyDemand: number
    materialsByType: Array<{ description: string; quantity: number; unit: string }>
  }

  export function EstimateReport(props: EstimateReportProps): React.JSX.Element
  ```
  Route: `GET /api/jobs/[jobId]/export/report` — Task 4 adds a button linking here.

- [ ] **Step 1: Install @react-pdf/renderer**

```bash
npm install @react-pdf/renderer
```

Expected: package added to `package.json` dependencies.

- [ ] **Step 2: Write failing route tests**

Create `src/app/api/jobs/[jobId]/export/report/__tests__/route.test.ts`:

```ts
import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockFindUnique, mockFindMany } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    job: { findUnique: mockFindUnique },
    phase: { findMany: mockFindMany },
  },
}))

// Mock renderToBuffer so tests don't actually render a PDF
vi.mock('@react-pdf/renderer', () => ({
  renderToBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-pdf')),
  Document: ({ children }: { children: React.ReactNode }) => children,
  Page: ({ children }: { children: React.ReactNode }) => children,
  Text: ({ children }: { children: React.ReactNode }) => children,
  View: ({ children }: { children: React.ReactNode }) => children,
  StyleSheet: { create: (s: unknown) => s },
  Font: { register: vi.fn() },
}))

import { GET } from '../route'

const mockJob = {
  id: 'j1',
  projectNumber: 'PRJ-001',
  title: 'Test Job',
  client: 'Internal',
  startDate: new Date('2026-06-01'),
  drawings: [
    {
      structureId: 'STR-01',
      structureName: 'Main Structure',
      zones: [
        {
          id: 'z1',
          label: 'Zone A',
          scaffoldType: 'independent',
          estimateItems: [
            { id: 'i1', category: 'labour', description: 'Erect', quantity: 10, unit: 'hrs', unitManhours: 1.5, overridden: false },
          ],
        },
      ],
    },
  ],
  phases: [
    { id: 'p1', structureId: 'STR-01', type: 'erect', startDate: new Date('2026-06-01'), endDate: new Date('2026-06-28'), manhoursTotal: 0 },
  ],
}

describe('GET /api/jobs/[jobId]/export/report', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a PDF with correct headers', async () => {
    mockFindUnique.mockResolvedValue(mockJob)
    const res = await GET({} as Request, { params: Promise.resolve({ jobId: 'j1' }) })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toContain('attachment')
    expect(res.headers.get('Content-Disposition')).toContain('.pdf')
  })

  it('returns 404 when job is not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    const res = await GET({} as Request, { params: Promise.resolve({ jobId: 'missing' }) })
    expect(res.status).toBe(404)
  })

  it('calls renderToBuffer once', async () => {
    mockFindUnique.mockResolvedValue(mockJob)
    await GET({} as Request, { params: Promise.resolve({ jobId: 'j1' }) })
    const { renderToBuffer } = await import('@react-pdf/renderer')
    expect(renderToBuffer).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 3: Run tests — expect FAIL (route not found)**

```bash
npx vitest run src/app/api/jobs/\\[jobId\\]/export/report/__tests__/route.test.ts
```

Expected: FAIL — `Cannot find module '../route'`

- [ ] **Step 4: Create the PDF React component**

Create `src/components/export/estimate-pdf.tsx`:

```tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

export type ReportStructure = {
  structureId: string
  structureName: string
  zones: Array<{
    label: string
    scaffoldType: string
    labourItems: Array<{ description: string; quantity: number; unit: string; unitManhours: number }>
    materialItems: Array<{ description: string; quantity: number; unit: string }>
    zoneManhours: number
  }>
  structureManhours: number
}

export type EstimateReportProps = {
  projectNumber: string
  title: string
  client: string
  date: string
  structures: ReportStructure[]
  totalManhours: number
  durationWeeks: number
  peakWeeklyDemand: number
  materialsByType: Array<{ description: string; quantity: number; unit: string }>
}

const S = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 9, color: '#1a1a1a' },
  header: { marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#0D1B2A', paddingBottom: 10 },
  headerTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#0D1B2A' },
  headerSub: { fontSize: 10, color: '#555', marginTop: 3 },
  green: { color: '#00B451', fontFamily: 'Helvetica-Bold' },
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#0D1B2A', marginTop: 16, marginBottom: 6 },
  zoneTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 4 },
  categoryLabel: { fontSize: 8, color: '#666', marginBottom: 3 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F2F5F9',
    padding: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  col1: { flex: 3 },
  col2: { flex: 1, textAlign: 'right' },
  col3: { flex: 1 },
  col4: { flex: 1, textAlign: 'right' },
  col5: { flex: 1, textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  summary: {
    marginTop: 24,
    padding: 12,
    backgroundColor: '#F2F5F9',
    borderLeftWidth: 3,
    borderLeftColor: '#00B451',
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryLabel: { color: '#555' },
  summaryValue: { fontFamily: 'Helvetica-Bold' },
})

function TableHeader({ labour }: { labour: boolean }) {
  return (
    <View style={S.tableHeader}>
      <Text style={S.col1}>Description</Text>
      <Text style={S.col2}>Qty</Text>
      <Text style={S.col3}>Unit</Text>
      {labour && <Text style={S.col4}>Hrs/unit</Text>}
      {labour && <Text style={S.col5}>Total hrs</Text>}
    </View>
  )
}

export function EstimateReport(props: EstimateReportProps): React.JSX.Element {
  return (
    <Document title={`Estimate — ${props.projectNumber}`}>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          <Text style={S.headerTitle}>
            <Text style={S.green}>NMDC Energy</Text> — Scaffolding Estimate
          </Text>
          <Text style={S.headerSub}>
            {props.projectNumber} · {props.title} · {props.client}
          </Text>
          <Text style={S.headerSub}>Date: {props.date}</Text>
        </View>

        {/* Per structure */}
        {props.structures.map((struct) => (
          <View key={struct.structureId}>
            <Text style={S.sectionTitle}>
              {struct.structureName}{' '}
              <Text style={{ fontFamily: 'Helvetica', fontSize: 9, color: '#666' }}>
                ({struct.structureId}) — {struct.structureManhours.toFixed(1)} hrs total
              </Text>
            </Text>

            {struct.zones.map((zone) => (
              <View key={zone.label}>
                <Text style={S.zoneTitle}>
                  {zone.label} ({zone.scaffoldType}) — {zone.zoneManhours.toFixed(1)} hrs
                </Text>

                {zone.labourItems.length > 0 && (
                  <View>
                    <Text style={S.categoryLabel}>LABOUR</Text>
                    <TableHeader labour />
                    {zone.labourItems.map((item, idx) => (
                      <View key={idx} style={S.tableRow}>
                        <Text style={S.col1}>{item.description}</Text>
                        <Text style={S.col2}>{item.quantity.toFixed(2)}</Text>
                        <Text style={S.col3}>{item.unit}</Text>
                        <Text style={S.col4}>{item.unitManhours.toFixed(2)}</Text>
                        <Text style={S.col5}>{(item.quantity * item.unitManhours).toFixed(2)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {zone.materialItems.length > 0 && (
                  <View>
                    <Text style={S.categoryLabel}>MATERIALS</Text>
                    <TableHeader labour={false} />
                    {zone.materialItems.map((item, idx) => (
                      <View key={idx} style={S.tableRow}>
                        <Text style={S.col1}>{item.description}</Text>
                        <Text style={S.col2}>{item.quantity.toFixed(2)}</Text>
                        <Text style={S.col3}>{item.unit}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        ))}

        {/* Summary */}
        <View style={S.summary}>
          <Text style={[S.sectionTitle, { marginTop: 0, marginBottom: 8 }]}>Summary</Text>
          <View style={S.summaryRow}>
            <Text style={S.summaryLabel}>Total Manhours</Text>
            <Text style={S.summaryValue}>{props.totalManhours.toFixed(1)} hrs</Text>
          </View>
          <View style={S.summaryRow}>
            <Text style={S.summaryLabel}>Duration</Text>
            <Text style={S.summaryValue}>{props.durationWeeks} week{props.durationWeeks !== 1 ? 's' : ''}</Text>
          </View>
          <View style={S.summaryRow}>
            <Text style={S.summaryLabel}>Peak Weekly Demand</Text>
            <Text style={S.summaryValue}>{props.peakWeeklyDemand.toFixed(1)} hrs/week</Text>
          </View>
          {props.materialsByType.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={[S.categoryLabel, { marginBottom: 4 }]}>Materials by Type</Text>
              {props.materialsByType.map((m, idx) => (
                <View key={idx} style={S.summaryRow}>
                  <Text style={S.summaryLabel}>{m.description}</Text>
                  <Text style={S.summaryValue}>{m.quantity.toFixed(2)} {m.unit}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 5: Create the PDF report route**

Create `src/app/api/jobs/[jobId]/export/report/route.ts`:

```ts
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
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
npx vitest run src/app/api/jobs/\\[jobId\\]/export/report/__tests__/route.test.ts
```

Expected: 3/3 PASS

- [ ] **Step 7: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add src/components/export/estimate-pdf.tsx \
        src/app/api/jobs/[jobId]/export/report/route.ts \
        src/app/api/jobs/[jobId]/export/report/__tests__/route.test.ts \
        package.json package-lock.json
git commit -m "feat: PDF estimate report per job via @react-pdf/renderer"
```

---

### Task 4: Export buttons on Estimate Sheet and Schedule pages

**Files:**
- Modify: `src/app/jobs/[jobId]/estimate/page.tsx`
- Modify: `src/app/schedule/page.tsx`

**Interfaces:**
- Consumes:
  - `GET /api/jobs/[jobId]/export/estimate` from Task 1
  - `GET /api/jobs/[jobId]/export/report` from Task 3
  - `GET /api/export/schedule` from Task 2
- Produces: no new exports; UI download links added to existing pages

No test file needed — these are server-component changes adding `<a>` download links, which are covered by route tests in Tasks 1–3.

- [ ] **Step 1: Add export buttons to the Estimate Sheet page**

Open `src/app/jobs/[jobId]/estimate/page.tsx`. The current return renders `<EstimateSheet />`. Wrap it to add a header with export buttons.

Replace the current `return (` block:

```tsx
// Current (approximately):
return (
  <EstimateSheet
    jobId={jobId}
    title={`${job.projectNumber} — ${job.title}`}
    structures={structures}
  />
)
```

With:

```tsx
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
    <div className="flex-1 overflow-auto">
      <EstimateSheet
        jobId={jobId}
        title={`${job.projectNumber} — ${job.title}`}
        structures={structures}
      />
    </div>
  </div>
)
```

Also add the `Button` import at the top of the file:

```ts
import { Button } from '@/components/ui/button'
```

- [ ] **Step 2: Verify the full estimate page file compiles**

```bash
npx tsc --noEmit
```

Expected: no TypeScript errors (or only pre-existing errors unrelated to the new code)

- [ ] **Step 3: Add schedule export button to the Schedule page**

Open `src/app/schedule/page.tsx`. The header currently has one Button linking to `/resources`. Add a second button for schedule export:

Find this block in the header div:

```tsx
<Button render={<Link href="/resources" />}
  style={{ fontSize: 12, padding: '4px 12px' }}>
  Resource View
</Button>
```

Replace with:

```tsx
<div className="flex gap-2">
  <Button
    render={<a href="/api/export/schedule" download />}
    style={{ fontSize: 12, padding: '4px 12px' }}
  >
    Export Schedule
  </Button>
  <Button render={<Link href="/resources" />}
    style={{ fontSize: 12, padding: '4px 12px' }}>
    Resource View
  </Button>
</div>
```

- [ ] **Step 4: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no new errors

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass (count unchanged from Task 3)

- [ ] **Step 6: Commit**

```bash
git add src/app/jobs/[jobId]/estimate/page.tsx \
        src/app/schedule/page.tsx
git commit -m "feat: add Export Excel, Export PDF, and Export Schedule buttons to UI"
```
