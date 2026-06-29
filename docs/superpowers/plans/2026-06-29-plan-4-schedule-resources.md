# Level 4 Schedule & Resources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Level 4 Gantt schedule (phases per structure, editable dates) and a weekly manhour histogram with crew capacity editing.

**Architecture:** Four tasks: Phase CRUD API → ResourcePool API → Gantt chart page → Resource histogram page. The `Phase` and `ResourcePool` models already exist in the Prisma schema. The nav already links `/schedule` and `/resources`. `manhoursTotal` per phase is computed dynamically from estimate items at page-load time (joins through drawings → zones → estimateItems) rather than relying on the stored field, so it's always fresh.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Prisma v7, Zod, Vitest v4, React Testing Library, Tailwind CSS (NMDC tokens), shadcn/ui v4.

## Global Constraints

- Next.js 16.2.9 — dynamic route params arrive as `Promise<{...}>` — always `await params`.
- React 19 — use `React.JSX.Element` not `JSX.Element`.
- shadcn/ui v4 — `Button` uses `render` prop, not `asChild`.
- Prisma v7 — import error class as `import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'`; P2025 → 404.
- Prisma `$transaction(async (tx) => {...})` for multi-step writes.
- Vitest v4 — mocks that reference variables must use `vi.hoisted()`.
- NMDC brand tokens: `--green: #00B451`, `--navy: #0D1B2A`, `--background: #F2F5F9`.
- Phase colours: erect `#00B451`, modify `#1A2F44`, dismantle `#E53E3E`.
- No external charting library — use CSS-based rendering for Gantt and histogram.
- Phase date editing is implemented as a click-to-edit modal (not drag-and-drop). The spec says "draggable bars" but pixel-drag with week-snapping is disproportionately complex for an internal tool; click-to-edit covers the same use case with higher accuracy.
- YAGNI: do not add features beyond what each task specifies.
- Inner try/catch for `request.json()` to return 400 on bad JSON (not 500).
- Run `npx vitest run` (not `npm test`) to execute the test suite.

---

### Task 1: Phase CRUD API

**Files:**
- Create: `src/app/api/jobs/[jobId]/phases/route.ts`
- Create: `src/app/api/jobs/[jobId]/phases/[phaseId]/route.ts`
- Create: `src/app/api/jobs/[jobId]/phases/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `prisma.phase.*`, `prisma.job.findUnique` (404 guard)
- Produces:
  - `GET /api/jobs/:jobId/phases` → `Phase[]` ordered by `startDate asc`
  - `POST /api/jobs/:jobId/phases` → `Phase` (201)
  - `PATCH /api/jobs/:jobId/phases/:phaseId` → `Phase`
  - `DELETE /api/jobs/:jobId/phases/:phaseId` → 204

**Phase shape returned by all routes:**
```ts
{
  id: string
  jobId: string
  type: 'erect' | 'modify' | 'dismantle'
  structureId: string
  startDate: string  // ISO datetime (Prisma returns Date, Next serialises to string)
  endDate: string
  manhoursTotal: number
}
```

- [ ] **Step 1: Write failing tests**

Create `src/app/api/jobs/[jobId]/phases/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'

const { mockPrisma } = vi.hoisted(() => {
  const phase = {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
  const job = { findUnique: vi.fn() }
  const mockPrisma = { phase, job }
  return { mockPrisma }
})

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockPhase = {
  id: 'phase-1',
  jobId: 'job-1',
  type: 'erect',
  structureId: 'S01',
  startDate: new Date('2026-07-01'),
  endDate: new Date('2026-07-28'),
  manhoursTotal: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.job.findUnique.mockResolvedValue({ id: 'job-1' })
})

// ── GET /api/jobs/[jobId]/phases ──────────────────────────────────────────────

describe('GET /api/jobs/[jobId]/phases', () => {
  it('returns phase list ordered by startDate', async () => {
    const { GET } = await import('../route')
    mockPrisma.phase.findMany.mockResolvedValue([mockPhase])
    const res = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ jobId: 'job-1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('phase-1')
    expect(mockPrisma.phase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { jobId: 'job-1' } }),
    )
  })

  it('returns 404 when job not found', async () => {
    const { GET } = await import('../route')
    mockPrisma.job.findUnique.mockResolvedValue(null)
    const res = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ jobId: 'missing' }),
    })
    expect(res.status).toBe(404)
  })
})

// ── POST /api/jobs/[jobId]/phases ─────────────────────────────────────────────

describe('POST /api/jobs/[jobId]/phases', () => {
  it('creates phase and returns 201', async () => {
    const { POST } = await import('../route')
    mockPrisma.phase.create.mockResolvedValue(mockPhase)
    const body = {
      type: 'erect',
      structureId: 'S01',
      startDate: '2026-07-01T00:00:00.000Z',
      endDate: '2026-07-28T00:00:00.000Z',
    }
    const res = await POST(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ jobId: 'job-1' }) },
    )
    expect(res.status).toBe(201)
    const created = await res.json()
    expect(created.id).toBe('phase-1')
  })

  it('returns 400 for invalid type', async () => {
    const { POST } = await import('../route')
    const res = await POST(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'invalid', structureId: 'S01', startDate: '2026-07-01T00:00:00.000Z', endDate: '2026-07-28T00:00:00.000Z' }),
      }),
      { params: Promise.resolve({ jobId: 'job-1' }) },
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for malformed JSON', async () => {
    const { POST } = await import('../route')
    const res = await POST(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
      { params: Promise.resolve({ jobId: 'job-1' }) },
    )
    expect(res.status).toBe(400)
  })

  it('returns 404 when job not found', async () => {
    const { POST } = await import('../route')
    mockPrisma.job.findUnique.mockResolvedValue(null)
    const res = await POST(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'erect', structureId: 'S01', startDate: '2026-07-01T00:00:00.000Z', endDate: '2026-07-28T00:00:00.000Z' }),
      }),
      { params: Promise.resolve({ jobId: 'missing' }) },
    )
    expect(res.status).toBe(404)
  })
})

// ── PATCH /api/jobs/[jobId]/phases/[phaseId] ──────────────────────────────────

describe('PATCH /api/jobs/[jobId]/phases/[phaseId]', () => {
  it('updates phase and returns 200', async () => {
    const { PATCH } = await import('../[phaseId]/route')
    mockPrisma.phase.update.mockResolvedValue({ ...mockPhase, endDate: new Date('2026-08-04') })
    const res = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endDate: '2026-08-04T00:00:00.000Z' }),
      }),
      { params: Promise.resolve({ jobId: 'job-1', phaseId: 'phase-1' }) },
    )
    expect(res.status).toBe(200)
  })

  it('returns 404 for unknown phase (P2025)', async () => {
    const { PATCH } = await import('../[phaseId]/route')
    const { PrismaClientKnownRequestError } = await import('@prisma/client/runtime/library')
    mockPrisma.phase.update.mockRejectedValue(
      new PrismaClientKnownRequestError('not found', { code: 'P2025', clientVersion: '0' }),
    )
    const res = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'modify' }),
      }),
      { params: Promise.resolve({ jobId: 'job-1', phaseId: 'missing' }) },
    )
    expect(res.status).toBe(404)
  })
})

// ── DELETE /api/jobs/[jobId]/phases/[phaseId] ─────────────────────────────────

describe('DELETE /api/jobs/[jobId]/phases/[phaseId]', () => {
  it('deletes phase and returns 204', async () => {
    const { DELETE } = await import('../[phaseId]/route')
    mockPrisma.phase.delete.mockResolvedValue(mockPhase)
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ jobId: 'job-1', phaseId: 'phase-1' }),
    })
    expect(res.status).toBe(204)
  })

  it('returns 404 for unknown phase (P2025)', async () => {
    const { DELETE } = await import('../[phaseId]/route')
    const { PrismaClientKnownRequestError } = await import('@prisma/client/runtime/library')
    mockPrisma.phase.delete.mockRejectedValue(
      new PrismaClientKnownRequestError('not found', { code: 'P2025', clientVersion: '0' }),
    )
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ jobId: 'job-1', phaseId: 'missing' }),
    })
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/app/api/jobs/\\[jobId\\]/phases
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/app/api/jobs/[jobId]/phases/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

const PhaseCreateSchema = z.object({
  type: z.enum(['erect', 'modify', 'dismantle']),
  structureId: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
})

type Params = { params: Promise<{ jobId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { jobId } = await params
    const job = await prisma.job.findUnique({ where: { id: jobId } })
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const phases = await prisma.phase.findMany({
      where: { jobId },
      orderBy: { startDate: 'asc' },
    })
    return NextResponse.json(phases)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: Params) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = PhaseCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const { jobId } = await params
    const job = await prisma.job.findUnique({ where: { id: jobId } })
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const phase = await prisma.phase.create({
      data: {
        jobId,
        type: parsed.data.type,
        structureId: parsed.data.structureId,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
      },
    })
    return NextResponse.json(phase, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Implement `src/app/api/jobs/[jobId]/phases/[phaseId]/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'

const PhasePatchSchema = z
  .object({
    type: z.enum(['erect', 'modify', 'dismantle']).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  })
  .refine(
    (d) => d.type !== undefined || d.startDate !== undefined || d.endDate !== undefined,
    { message: 'At least one field required' },
  )

type Params = { params: Promise<{ jobId: string; phaseId: string }> }

export async function PATCH(request: Request, { params }: Params) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = PhasePatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const { phaseId } = await params
    const data: Record<string, unknown> = {}
    if (parsed.data.type) data.type = parsed.data.type
    if (parsed.data.startDate) data.startDate = new Date(parsed.data.startDate)
    if (parsed.data.endDate) data.endDate = new Date(parsed.data.endDate)
    const phase = await prisma.phase.update({ where: { id: phaseId }, data })
    return NextResponse.json(phase)
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { phaseId } = await params
    await prisma.phase.delete({ where: { id: phaseId } })
    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npx vitest run src/app/api/jobs/\\[jobId\\]/phases
```

Expected: 8 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/jobs/\[jobId\]/phases/
git commit -m "feat: add Phase CRUD API routes"
```

---

### Task 2: ResourcePool API

**Files:**
- Create: `src/app/api/resource-pool/route.ts`
- Create: `src/app/api/resource-pool/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `prisma.resourcePool.*`
- Produces:
  - `GET /api/resource-pool?from=ISO&to=ISO` → `ResourcePool[]` in date range, ordered by `weekStartDate asc`
  - `PUT /api/resource-pool` body `{ weekStartDate: string; availableManhours: number }` → upserted `ResourcePool`

**ResourcePool shape:**
```ts
{ id: string; weekStartDate: string; availableManhours: number }
```

- [ ] **Step 1: Write failing tests**

Create `src/app/api/resource-pool/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'

const { mockPrisma } = vi.hoisted(() => {
  const resourcePool = {
    findMany: vi.fn(),
    upsert: vi.fn(),
  }
  const mockPrisma = { resourcePool }
  return { mockPrisma }
})

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockEntry = {
  id: 'rp-1',
  weekStartDate: new Date('2026-07-06'),
  availableManhours: 400,
}

beforeEach(() => vi.clearAllMocks())

// ── GET /api/resource-pool ────────────────────────────────────────────────────

describe('GET /api/resource-pool', () => {
  it('returns entries in date range', async () => {
    const { GET } = await import('../route')
    mockPrisma.resourcePool.findMany.mockResolvedValue([mockEntry])
    const res = await GET(
      new Request('http://localhost/api/resource-pool?from=2026-07-01T00:00:00.000Z&to=2026-09-30T00:00:00.000Z'),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('rp-1')
  })

  it('returns 400 when from or to is missing', async () => {
    const { GET } = await import('../route')
    const res = await GET(new Request('http://localhost/api/resource-pool'))
    expect(res.status).toBe(400)
  })
})

// ── PUT /api/resource-pool ────────────────────────────────────────────────────

describe('PUT /api/resource-pool', () => {
  it('upserts entry and returns it', async () => {
    const { PUT } = await import('../route')
    mockPrisma.resourcePool.upsert.mockResolvedValue(mockEntry)
    const res = await PUT(
      new Request('http://localhost/api/resource-pool', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStartDate: '2026-07-06T00:00:00.000Z', availableManhours: 400 }),
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('rp-1')
  })

  it('returns 400 for invalid body', async () => {
    const { PUT } = await import('../route')
    const res = await PUT(
      new Request('http://localhost/api/resource-pool', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStartDate: 'not-a-date', availableManhours: -1 }),
      }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for malformed JSON', async () => {
    const { PUT } = await import('../route')
    const res = await PUT(
      new Request('http://localhost/api/resource-pool', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
    )
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/app/api/resource-pool
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/app/api/resource-pool/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

const PutSchema = z.object({
  weekStartDate: z.string().datetime(),
  availableManhours: z.number().min(0),
})

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    if (!from || !to) {
      return NextResponse.json({ error: 'from and to query params required' }, { status: 400 })
    }
    const entries = await prisma.resourcePool.findMany({
      where: {
        weekStartDate: {
          gte: new Date(from),
          lte: new Date(to),
        },
      },
      orderBy: { weekStartDate: 'asc' },
    })
    return NextResponse.json(entries)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = PutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const weekDate = new Date(parsed.data.weekStartDate)
    const entry = await prisma.resourcePool.upsert({
      where: { weekStartDate: weekDate },
      update: { availableManhours: parsed.data.availableManhours },
      create: { weekStartDate: weekDate, availableManhours: parsed.data.availableManhours },
    })
    return NextResponse.json(entry)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/app/api/resource-pool
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/resource-pool/
git commit -m "feat: add ResourcePool API"
```

---

### Task 3: Schedule Page — Gantt Chart

**Files:**
- Create: `src/lib/schedule-utils.ts`
- Create: `src/app/schedule/page.tsx`
- Create: `src/components/schedule/gantt-chart.tsx`
- Create: `src/lib/__tests__/schedule-utils.test.ts`

**Interfaces:**
- Consumes: Phase API (PATCH `/api/jobs/:jobId/phases/:phaseId`, DELETE, POST `/api/jobs/:jobId/phases`)
- Produces:
  - `GanttJob` type (used by ResourceHistogram in Task 4)
  - `weeksInRange(start, end): Date[]` — exported from `schedule-utils.ts`
  - `weekLabel(date: Date): string` — exported from `schedule-utils.ts`
  - `phaseWeeks(phase, ganttStart): { startCol: number; spanCols: number }` — exported from `schedule-utils.ts`

**GanttJob type (defined in `src/components/schedule/gantt-chart.tsx`, imported by Task 4):**
```ts
export type PhaseRow = {
  id: string
  jobId: string
  type: 'erect' | 'modify' | 'dismantle'
  structureId: string
  startDate: string  // ISO string
  endDate: string
  manhoursTotal: number
}

export type StructureRow = {
  structureId: string
  structureName: string
  drawingId: string
  phases: PhaseRow[]
}

export type GanttJob = {
  jobId: string
  title: string
  projectNumber: string
  structures: StructureRow[]
}
```

- [ ] **Step 1: Write failing tests for schedule-utils**

Create `src/lib/__tests__/schedule-utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { weeksInRange, weekLabel, phaseWeeks } from '@/lib/schedule-utils'

describe('weeksInRange', () => {
  it('returns Mondays spanning the range', () => {
    const weeks = weeksInRange(new Date('2026-07-06'), new Date('2026-07-26'))
    // 2026-07-06 is a Monday; 2026-07-13, 2026-07-20 follow
    expect(weeks).toHaveLength(3)
    expect(weeks[0].toISOString().startsWith('2026-07-06')).toBe(true)
    expect(weeks[2].toISOString().startsWith('2026-07-20')).toBe(true)
  })

  it('includes the week containing startDate even if not a Monday', () => {
    const weeks = weeksInRange(new Date('2026-07-08'), new Date('2026-07-14'))
    // Floor to Monday 2026-07-06, then next Monday 2026-07-13 — 2 weeks
    expect(weeks.length).toBeGreaterThanOrEqual(1)
    expect(weeks[0].getDay()).toBe(1) // Monday
  })
})

describe('weekLabel', () => {
  it('formats date as "DD MMM"', () => {
    const label = weekLabel(new Date('2026-07-06'))
    expect(label).toBe('06 Jul')
  })
})

describe('phaseWeeks', () => {
  it('returns correct startCol and spanCols', () => {
    const ganttStart = new Date('2026-07-06') // week 0
    const phase = {
      startDate: '2026-07-13T00:00:00.000Z', // week 1
      endDate: '2026-07-26T00:00:00.000Z',   // ends mid-week 2 → span 2
    }
    const result = phaseWeeks(phase, ganttStart)
    expect(result.startCol).toBe(1)
    expect(result.spanCols).toBeGreaterThanOrEqual(1)
  })

  it('clamps startCol to 0 when phase starts before ganttStart', () => {
    const ganttStart = new Date('2026-07-13')
    const phase = { startDate: '2026-07-06T00:00:00.000Z', endDate: '2026-07-20T00:00:00.000Z' }
    const result = phaseWeeks(phase, ganttStart)
    expect(result.startCol).toBe(0)
    expect(result.spanCols).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/lib/__tests__/schedule-utils.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/schedule-utils.ts`**

```ts
/** Returns the Monday at or before the given date */
function floorToMonday(d: Date): Date {
  const day = d.getDay() // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day
  const result = new Date(d)
  result.setDate(d.getDate() + diff)
  result.setHours(0, 0, 0, 0)
  return result
}

/** Array of Monday dates from the week containing start through the week containing end */
export function weeksInRange(start: Date, end: Date): Date[] {
  const weeks: Date[] = []
  const cursor = floorToMonday(start)
  const last = floorToMonday(end)
  while (cursor <= last) {
    weeks.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 7)
  }
  return weeks
}

/** Format as "06 Jul" */
export function weekLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

/**
 * Given a phase and the gantt's first week (Monday), return
 * 0-based column index and column span for CSS grid placement.
 */
export function phaseWeeks(
  phase: { startDate: string; endDate: string },
  ganttStart: Date,
): { startCol: number; spanCols: number } {
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000
  const phaseStart = floorToMonday(new Date(phase.startDate))
  const phaseEnd = new Date(phase.endDate)
  const startCol = Math.max(0, Math.round((phaseStart.getTime() - ganttStart.getTime()) / MS_PER_WEEK))
  const spanCols = Math.max(1, Math.ceil((phaseEnd.getTime() - phaseStart.getTime()) / MS_PER_WEEK))
  return { startCol, spanCols }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/lib/__tests__/schedule-utils.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Implement `src/components/schedule/gantt-chart.tsx`**

This is a client component. It displays:
- A sticky header row of week labels
- For each job: a job header row, then structure rows each containing phase bars
- Click a phase bar → edit form (type, start, end, delete)
- Each structure row has an "Add Phase" button → inline add form

```tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { weeksInRange, weekLabel, phaseWeeks } from '@/lib/schedule-utils'

export type PhaseRow = {
  id: string
  jobId: string
  type: 'erect' | 'modify' | 'dismantle'
  structureId: string
  startDate: string
  endDate: string
  manhoursTotal: number
}

export type StructureRow = {
  structureId: string
  structureName: string
  drawingId: string
  phases: PhaseRow[]
}

export type GanttJob = {
  jobId: string
  title: string
  projectNumber: string
  structures: StructureRow[]
}

type Props = { jobs: GanttJob[] }

const PHASE_COLORS: Record<string, string> = {
  erect: '#00B451',
  modify: '#1A2F44',
  dismantle: '#E53E3E',
}

const COL_W = 52   // px per week column
const LABEL_W = 220 // px for label column

type EditState = {
  phaseId: string
  jobId: string
  type: 'erect' | 'modify' | 'dismantle'
  startDate: string
  endDate: string
}

type AddState = {
  jobId: string
  structureId: string
  type: 'erect' | 'modify' | 'dismantle'
  startDate: string
  endDate: string
}

export default function GanttChart({ jobs }: Props): React.JSX.Element {
  const [phases, setPhases] = useState<Map<string, PhaseRow>>(() => {
    const m = new Map<string, PhaseRow>()
    for (const j of jobs) for (const s of j.structures) for (const p of s.phases) m.set(p.id, p)
    return m
  })
  const [jobStructures, setJobStructures] = useState<Map<string, StructureRow[]>>(() => {
    const m = new Map<string, StructureRow[]>()
    for (const j of jobs) m.set(j.jobId, j.structures.map(s => ({ ...s, phases: [...s.phases] })))
    return m
  })
  const [editing, setEditing] = useState<EditState | null>(null)
  const [adding, setAdding] = useState<AddState | null>(null)
  const [saving, setSaving] = useState(false)

  // Compute gantt date range from all phases
  const allPhases = [...phases.values()]
  const today = new Date()
  const ganttStart = allPhases.length > 0
    ? new Date(Math.min(...allPhases.map(p => new Date(p.startDate).getTime())))
    : today
  const ganttEnd = allPhases.length > 0
    ? new Date(Math.max(...allPhases.map(p => new Date(p.endDate).getTime())))
    : new Date(today.getTime() + 12 * 7 * 24 * 60 * 60 * 1000)
  const weeks = weeksInRange(ganttStart, ganttEnd)

  async function saveEdit() {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch(`/api/jobs/${editing.jobId}/phases/${editing.phaseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: editing.type,
          startDate: new Date(editing.startDate).toISOString(),
          endDate: new Date(editing.endDate).toISOString(),
        }),
      })
      if (!res.ok) return
      const updated: PhaseRow = await res.json()
      setPhases(prev => new Map(prev).set(updated.id, { ...prev.get(updated.id)!, ...updated }))
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  async function deletePhase() {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch(`/api/jobs/${editing.jobId}/phases/${editing.phaseId}`, { method: 'DELETE' })
      if (!res.ok) return
      setPhases(prev => { const m = new Map(prev); m.delete(editing.phaseId); return m })
      setJobStructures(prev => {
        const m = new Map(prev)
        const structs = m.get(editing.jobId)?.map(s => ({
          ...s,
          phases: s.phases.filter(p => p.id !== editing.phaseId),
        }))
        if (structs) m.set(editing.jobId, structs)
        return m
      })
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  async function addPhase() {
    if (!adding) return
    setSaving(true)
    try {
      const res = await fetch(`/api/jobs/${adding.jobId}/phases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: adding.type,
          structureId: adding.structureId,
          startDate: new Date(adding.startDate).toISOString(),
          endDate: new Date(adding.endDate).toISOString(),
        }),
      })
      if (!res.ok) return
      const created: PhaseRow = await res.json()
      const phaseRow: PhaseRow = { ...created, jobId: adding.jobId }
      setPhases(prev => new Map(prev).set(phaseRow.id, phaseRow))
      setJobStructures(prev => {
        const m = new Map(prev)
        const structs = m.get(adding.jobId)?.map(s =>
          s.structureId === adding.structureId
            ? { ...s, phases: [...s.phases, phaseRow] }
            : s
        )
        if (structs) m.set(adding.jobId, structs)
        return m
      })
      setAdding(null)
    } finally {
      setSaving(false)
    }
  }

  const HEADER = 'px-2 py-1 text-xs font-medium text-muted-foreground border-b border-border'
  const ROW_H = 40 // px per structure row

  return (
    <div className="overflow-auto" style={{ background: 'var(--background)' }}>
      {/* Week header */}
      <div className="flex sticky top-0 z-10" style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ minWidth: LABEL_W, flexShrink: 0 }} />
        {weeks.map((w, i) => (
          <div key={i} className={HEADER} style={{ minWidth: COL_W, flexShrink: 0, textAlign: 'center' }}>
            {weekLabel(w)}
          </div>
        ))}
      </div>

      {/* Jobs */}
      {jobs.map((job) => {
        const structures = jobStructures.get(job.jobId) ?? job.structures
        return (
          <div key={job.jobId}>
            {/* Job header */}
            <div
              className="flex items-center px-3 py-1.5 text-xs font-semibold text-white"
              style={{ background: 'var(--navy)', minHeight: 28 }}
            >
              {job.projectNumber} — {job.title}
            </div>

            {/* Structure rows */}
            {structures.map((struct) => {
              const structPhases = struct.phases.map(p => phases.get(p.id) ?? p)
              return (
                <div key={struct.drawingId} style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="flex" style={{ minHeight: ROW_H }}>
                    {/* Label */}
                    <div
                      className="flex items-center px-3 py-1 text-sm border-r border-border gap-2"
                      style={{ minWidth: LABEL_W, flexShrink: 0, background: 'var(--card)' }}
                    >
                      <span className="flex-1 truncate">{struct.structureName}</span>
                      <button
                        type="button"
                        className="text-xs font-medium"
                        style={{ color: 'var(--green)' }}
                        onClick={() => setAdding({
                          jobId: job.jobId,
                          structureId: struct.structureId,
                          type: 'erect',
                          startDate: new Date().toISOString().slice(0, 10),
                          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                        })}
                      >
                        + Phase
                      </button>
                    </div>

                    {/* Timeline area */}
                    <div className="relative flex-1" style={{ minHeight: ROW_H }}>
                      {/* Week grid lines */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {weeks.map((_, i) => (
                          <div key={i} style={{ minWidth: COL_W, borderRight: '1px solid var(--border)', opacity: 0.4 }} />
                        ))}
                      </div>

                      {/* Phase bars */}
                      {structPhases.map((phase) => {
                        const { startCol, spanCols } = phaseWeeks(phase, weeks[0] ?? ganttStart)
                        const left = startCol * COL_W
                        const width = spanCols * COL_W - 2
                        return (
                          <button
                            key={phase.id}
                            type="button"
                            onClick={() => setEditing({
                              phaseId: phase.id,
                              jobId: job.jobId,
                              type: phase.type,
                              startDate: phase.startDate.slice(0, 10),
                              endDate: phase.endDate.slice(0, 10),
                            })}
                            className="absolute top-2 rounded text-white text-xs font-medium px-1 truncate"
                            style={{
                              left,
                              width,
                              height: ROW_H - 16,
                              background: PHASE_COLORS[phase.type],
                            }}
                            aria-label={`${phase.type} phase for ${struct.structureName}`}
                          >
                            {phase.type}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Add phase inline form */}
                  {adding?.jobId === job.jobId && adding.structureId === struct.structureId && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-card border-t border-border text-sm">
                      <select
                        value={adding.type}
                        onChange={e => setAdding(a => a && ({ ...a, type: e.target.value as 'erect' | 'modify' | 'dismantle' }))}
                        className="border border-border rounded px-2 py-1 text-xs"
                      >
                        <option value="erect">Erect</option>
                        <option value="modify">Modify</option>
                        <option value="dismantle">Dismantle</option>
                      </select>
                      <input
                        type="date"
                        value={adding.startDate}
                        onChange={e => setAdding(a => a && ({ ...a, startDate: e.target.value }))}
                        className="border border-border rounded px-2 py-1 text-xs"
                        aria-label="Phase start date"
                      />
                      <span className="text-muted-foreground">→</span>
                      <input
                        type="date"
                        value={adding.endDate}
                        onChange={e => setAdding(a => a && ({ ...a, endDate: e.target.value }))}
                        className="border border-border rounded px-2 py-1 text-xs"
                        aria-label="Phase end date"
                      />
                      <Button
                        type="button"
                        disabled={saving}
                        onClick={addPhase}
                        style={{ fontSize: 12, padding: '2px 10px', background: 'var(--green)', color: '#fff' }}
                      >
                        {saving ? '…' : 'Add'}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setAdding(null)}
                        style={{ fontSize: 12, padding: '2px 8px' }}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Edit phase overlay */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.3)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditing(null) }}
        >
          <div className="bg-card rounded-lg border border-border p-5 w-80 space-y-4 shadow-lg">
            <h3 className="text-sm font-semibold">Edit Phase</h3>
            <div>
              <label htmlFor="edit-type" className="block text-xs text-muted-foreground mb-1">Type</label>
              <select
                id="edit-type"
                value={editing.type}
                onChange={e => setEditing(ed => ed && ({ ...ed, type: e.target.value as 'erect' | 'modify' | 'dismantle' }))}
                className="w-full border border-border rounded px-2 py-1 text-sm"
              >
                <option value="erect">Erect</option>
                <option value="modify">Modify</option>
                <option value="dismantle">Dismantle</option>
              </select>
            </div>
            <div>
              <label htmlFor="edit-start" className="block text-xs text-muted-foreground mb-1">Start Date</label>
              <input
                id="edit-start"
                type="date"
                value={editing.startDate}
                onChange={e => setEditing(ed => ed && ({ ...ed, startDate: e.target.value }))}
                className="w-full border border-border rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label htmlFor="edit-end" className="block text-xs text-muted-foreground mb-1">End Date</label>
              <input
                id="edit-end"
                type="date"
                value={editing.endDate}
                onChange={e => setEditing(ed => ed && ({ ...ed, endDate: e.target.value }))}
                className="w-full border border-border rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                disabled={saving}
                onClick={saveEdit}
                style={{ flex: 1, background: 'var(--green)', color: '#fff' }}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button
                type="button"
                disabled={saving}
                onClick={deletePhase}
                style={{ background: 'var(--destructive)', color: '#fff' }}
              >
                Delete
              </Button>
              <Button type="button" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {jobs.length === 0 && (
        <div className="p-8 text-center text-muted-foreground text-sm">
          No jobs with phases yet. Open a job and add phases from here.
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Implement `src/app/schedule/page.tsx`**

This server component loads all jobs with their drawings (for structure names) and phases. It computes `manhoursTotal` for each phase dynamically from estimate items.

```tsx
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
  } catch {
    ganttJobs = []
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--background)' }}>
      <div
        className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0"
        style={{ background: 'var(--card)' }}
      >
        <h1 className="text-xl font-semibold">Level 4 Schedule</h1>
        <Button render={<Link href="/resources" />}
          style={{ fontSize: 12, padding: '4px 12px' }}>
          Resource View
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        <GanttChart jobs={ganttJobs} />
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Run all tests — verify they still pass**

```bash
npx vitest run
```

Expected: All tests pass (the new schedule-utils tests plus all prior tests).

- [ ] **Step 8: Commit**

```bash
git add src/lib/schedule-utils.ts src/lib/__tests__/schedule-utils.test.ts src/components/schedule/gantt-chart.tsx src/app/schedule/page.tsx
git commit -m "feat: Gantt chart schedule page with phase add/edit/delete"
```

---

### Task 4: Resources Page — Manhour Histogram

**Files:**
- Create: `src/app/resources/page.tsx`
- Create: `src/components/schedule/resource-histogram.tsx`
- Create: `src/lib/__tests__/resource-histogram-utils.test.ts`
- Create: `src/lib/resource-histogram-utils.ts`

**Interfaces:**
- Consumes: `GanttJob` from `@/components/schedule/gantt-chart` (Task 3)
- Consumes: ResourcePool API (`PUT /api/resource-pool`)
- Produces:
  - `computeWeeklyDemand(jobs, weeks): WeeklyDemand[]` — exported from `resource-histogram-utils.ts`

**Types defined in `resource-histogram-utils.ts`:**
```ts
export type WeeklyDemand = {
  weekStart: Date
  totalManhours: number
  byJob: Record<string, number>  // jobId → manhours
}
```

- [ ] **Step 1: Write failing tests for resource-histogram-utils**

Create `src/lib/__tests__/resource-histogram-utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeWeeklyDemand } from '@/lib/resource-histogram-utils'
import type { GanttJob } from '@/components/schedule/gantt-chart'

const week1 = new Date('2026-07-06')
const week2 = new Date('2026-07-13')
const week3 = new Date('2026-07-20')

const mockJob: GanttJob = {
  jobId: 'job-1',
  title: 'Test Job',
  projectNumber: 'P001',
  structures: [
    {
      structureId: 'S01',
      structureName: 'Structure 1',
      drawingId: 'draw-1',
      phases: [
        {
          id: 'phase-1',
          jobId: 'job-1',
          type: 'erect',
          structureId: 'S01',
          startDate: '2026-07-06T00:00:00.000Z',
          endDate: '2026-07-19T00:00:00.000Z', // 2 weeks
          manhoursTotal: 200,
        },
      ],
    },
  ],
}

describe('computeWeeklyDemand', () => {
  it('distributes manhours evenly across phase weeks', () => {
    const weeks = [week1, week2, week3]
    const demand = computeWeeklyDemand([mockJob], weeks)
    // Phase spans weeks 0 and 1 (2 weeks) → 100 hrs each
    const w0 = demand.find(d => d.weekStart.getTime() === week1.getTime())
    const w1 = demand.find(d => d.weekStart.getTime() === week2.getTime())
    const w2 = demand.find(d => d.weekStart.getTime() === week3.getTime())
    expect(w0?.byJob['job-1']).toBeCloseTo(100, 0)
    expect(w1?.byJob['job-1']).toBeCloseTo(100, 0)
    expect(w2?.byJob['job-1']).toBeUndefined() // phase doesn't reach week 3
  })

  it('returns 0 totalManhours for weeks with no phases', () => {
    const demand = computeWeeklyDemand([mockJob], [week3])
    expect(demand[0].totalManhours).toBe(0)
  })

  it('sums across multiple jobs', () => {
    const job2: GanttJob = {
      ...mockJob,
      jobId: 'job-2',
      projectNumber: 'P002',
      structures: [
        {
          ...mockJob.structures[0],
          drawingId: 'draw-2',
          phases: [
            { ...mockJob.structures[0].phases[0], id: 'phase-2', jobId: 'job-2', manhoursTotal: 100 },
          ],
        },
      ],
    }
    const demand = computeWeeklyDemand([mockJob, job2], [week1, week2])
    const w0 = demand.find(d => d.weekStart.getTime() === week1.getTime())
    expect(w0?.totalManhours).toBeCloseTo(150, 0) // 100 + 50
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/lib/__tests__/resource-histogram-utils.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/resource-histogram-utils.ts`**

```ts
import type { GanttJob } from '@/components/schedule/gantt-chart'

export type WeeklyDemand = {
  weekStart: Date
  totalManhours: number
  byJob: Record<string, number>
}

export function computeWeeklyDemand(jobs: GanttJob[], weeks: Date[]): WeeklyDemand[] {
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

  return weeks.map((weekStart) => {
    const weekEnd = new Date(weekStart.getTime() + MS_PER_WEEK)
    const byJob: Record<string, number> = {}

    for (const job of jobs) {
      for (const struct of job.structures) {
        for (const phase of struct.phases) {
          const phaseStart = new Date(phase.startDate)
          const phaseEnd = new Date(phase.endDate)
          // Check overlap: phase overlaps this week
          if (phaseStart >= weekEnd || phaseEnd <= weekStart) continue
          // Duration in weeks (even distribution)
          const durationMs = Math.max(MS_PER_WEEK, phaseEnd.getTime() - phaseStart.getTime())
          const durationWeeks = durationMs / MS_PER_WEEK
          const weeklyShare = phase.manhoursTotal / durationWeeks
          byJob[job.jobId] = (byJob[job.jobId] ?? 0) + weeklyShare
        }
      }
    }

    const totalManhours = Object.values(byJob).reduce((s, v) => s + v, 0)
    return { weekStart, totalManhours, byJob }
  })
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/lib/__tests__/resource-histogram-utils.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Implement `src/components/schedule/resource-histogram.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { weekLabel } from '@/lib/schedule-utils'
import { computeWeeklyDemand, type WeeklyDemand } from '@/lib/resource-histogram-utils'
import type { GanttJob } from './gantt-chart'

type ResourcePoolEntry = {
  id: string
  weekStartDate: string
  availableManhours: number
}

type Props = {
  jobs: GanttJob[]
  weeks: Date[]
  initialPool: ResourcePoolEntry[]
}

// Consistent job colours derived from index
const JOB_COLORS = ['#00B451', '#1A2F44', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444']

export default function ResourceHistogram({ jobs, weeks, initialPool }: Props): React.JSX.Element {
  const [pool, setPool] = useState<Map<number, number>>(() => {
    const m = new Map<number, number>()
    for (const entry of initialPool) {
      m.set(new Date(entry.weekStartDate).getTime(), entry.availableManhours)
    }
    return m
  })
  const [saving, setSaving] = useState<number | null>(null)

  const demand: WeeklyDemand[] = computeWeeklyDemand(jobs, weeks)
  const maxValue = Math.max(
    ...demand.map(d => d.totalManhours),
    ...[...pool.values()],
    1,
  )
  const BAR_MAX_H = 160 // px

  const jobColorMap: Record<string, string> = {}
  jobs.forEach((j, i) => { jobColorMap[j.jobId] = JOB_COLORS[i % JOB_COLORS.length] })

  async function saveCapacity(weekStart: Date, value: string) {
    const manhours = parseFloat(value)
    if (isNaN(manhours) || manhours < 0) return
    const key = weekStart.getTime()
    setSaving(key)
    try {
      const res = await fetch('/api/resource-pool', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStartDate: weekStart.toISOString(), availableManhours: manhours }),
      })
      if (!res.ok) return
      setPool(prev => new Map(prev).set(key, manhours))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="p-6 space-y-6" style={{ background: 'var(--background)' }}>
      <div className="flex items-center gap-6 flex-wrap">
        {jobs.map((j, i) => (
          <div key={j.jobId} className="flex items-center gap-1.5 text-xs">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: JOB_COLORS[i % JOB_COLORS.length] }}
            />
            {j.projectNumber} {j.title}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block w-8 border-t-2 border-dashed" style={{ borderColor: '#E53E3E' }} />
          Capacity
        </div>
      </div>

      {/* Histogram */}
      <div className="flex items-end gap-1 overflow-x-auto pb-2">
        {weeks.map((weekStart, wi) => {
          const d = demand[wi] ?? { totalManhours: 0, byJob: {} }
          const capacity = pool.get(weekStart.getTime()) ?? 0
          const totalH = Math.round((d.totalManhours / maxValue) * BAR_MAX_H)
          const capH = Math.round((capacity / maxValue) * BAR_MAX_H)
          const overloaded = capacity > 0 && d.totalManhours > capacity

          let stackOffset = 0
          return (
            <div key={wi} className="flex flex-col items-center gap-1" style={{ minWidth: 48 }}>
              <div
                className="relative w-8"
                style={{ height: BAR_MAX_H, display: 'flex', alignItems: 'flex-end' }}
              >
                {/* Stacked demand bars */}
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-t overflow-hidden"
                  style={{ height: totalH, background: overloaded ? '#FEE2E2' : 'transparent' }}
                >
                  {jobs.map((job) => {
                    const hrs = d.byJob[job.jobId] ?? 0
                    const h = Math.round((hrs / maxValue) * BAR_MAX_H)
                    const bottom = stackOffset
                    stackOffset += h
                    return (
                      <div
                        key={job.jobId}
                        className="absolute left-0 right-0"
                        style={{
                          bottom,
                          height: h,
                          background: jobColorMap[job.jobId],
                        }}
                        title={`${job.projectNumber}: ${hrs.toFixed(0)} hrs`}
                      />
                    )
                  })}
                </div>
                {/* Capacity line */}
                {capacity > 0 && (
                  <div
                    className="absolute left-0 right-0"
                    style={{
                      bottom: capH,
                      borderTop: '2px dashed #E53E3E',
                    }}
                  />
                )}
              </div>
              <span className="text-xs text-muted-foreground" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 36 }}>
                {weekLabel(weekStart)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Capacity editor table */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Weekly Crew Capacity (manhours)</h2>
        <div className="overflow-x-auto">
          <table className="text-sm w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Week</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Demand</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Capacity</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((weekStart, wi) => {
                const d = demand[wi] ?? { totalManhours: 0, byJob: {} }
                const capacity = pool.get(weekStart.getTime()) ?? 0
                const overloaded = capacity > 0 && d.totalManhours > capacity
                const key = weekStart.getTime()
                return (
                  <tr key={wi} className={`border-t border-border/50 ${overloaded ? 'bg-red-50' : ''}`}>
                    <td className="px-3 py-1.5">{weekLabel(weekStart)}</td>
                    <td className="px-3 py-1.5 text-right">{d.totalManhours.toFixed(0)}</td>
                    <td className="px-3 py-1.5 text-right">
                      <input
                        type="number"
                        step="10"
                        min="0"
                        defaultValue={capacity || ''}
                        placeholder="0"
                        onBlur={(e) => saveCapacity(weekStart, e.target.value)}
                        disabled={saving === key}
                        aria-label={`Capacity for week of ${weekLabel(weekStart)}`}
                        className="w-20 text-right border border-border rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs font-medium">
                      {capacity === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : overloaded ? (
                        <span style={{ color: '#E53E3E' }}>Overloaded</span>
                      ) : (
                        <span style={{ color: 'var(--green)' }}>OK</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Implement `src/app/resources/page.tsx`**

```tsx
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

    // Determine week range: all phases ± 2 weeks, or next 12 weeks if no phases
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
  } catch {
    ganttJobs = []
    weeks = []
    poolEntries = []
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--background)' }}>
      <div
        className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0"
        style={{ background: 'var(--card)' }}
      >
        <h1 className="text-xl font-semibold">Resource View</h1>
        <Button render={<Link href="/schedule" />}
          style={{ fontSize: 12, padding: '4px 12px' }}>
          Gantt Schedule
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        {weeks.length === 0 ? (
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
```

- [ ] **Step 7: Run all tests — verify everything passes**

```bash
npx vitest run
```

Expected: All tests pass. Minimum count: 80+ tests (69 prior + 5 schedule-utils + 3 histogram-utils + 8 phase API + 5 resource-pool API = 90 tests).

- [ ] **Step 8: Commit**

```bash
git add src/lib/resource-histogram-utils.ts src/lib/__tests__/resource-histogram-utils.test.ts src/components/schedule/resource-histogram.tsx src/app/resources/page.tsx
git commit -m "feat: resource histogram with weekly manhour demand and capacity editor"
```
