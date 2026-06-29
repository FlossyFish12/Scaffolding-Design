# Drawing Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Drawing Editor screen — PDF rendering via PDF.js, zone annotation via Konva.js, zone CRUD API, and scaffold type auto-suggestion.

**Architecture:** A server-side page loads the drawing record and initial zones from Prisma, then passes them to a single `DrawingEditor` client component (dynamically imported with `ssr: false`). Inside that component, `PdfViewer` renders the PDF to a `<canvas>` using pdfjs-dist, and `CanvasLayer` lays a Konva Stage on top for drawing/displaying zone rectangles. A `ZonePanel` right-sidebar shows a form for the zone currently being created or edited; it auto-suggests scaffold type using a pure `suggestScaffoldType` function. Zone state is managed in `DrawingEditor` and persisted via the Zone API routes.

**Tech Stack:**
- Next.js 16.2.9 App Router — server component page + client component editor
- `pdfjs-dist` — PDF rendering
- `konva` + `react-konva` — canvas annotation layer
- `react-hook-form` — zone panel form
- `zod` — API request validation
- Prisma v7 with `@prisma/adapter-pg` — database
- Vitest v4.1.9 — tests

## Global Constraints

- **Next.js 16.2.9**: route `params` are `Promise<{...}>` — always `await params`
- **Prisma v7**: `import { PrismaClient } from '@prisma/client'`; import types as `import type { AccessType, ... } from '@prisma/client'`
- **shadcn/ui v4.12.0**: Button uses `render` prop, NOT `asChild`; e.g. `<Button render={<Link href="..." />}>label</Button>`
- **Vitest v4.1.9**: constructor mocks require `vi.fn(function() { return {...} })`, NOT arrow functions
- **Zone coordinates**: stored as fractions 0–1 of page width/height in `canvasData` JSON field, making zones page-scale-independent
- **NMDC brand tokens**: `--green: #00B451`, `--navy: #0D1B2A`, `--green-dark: #008C3E`
- **TypeScript strict mode** throughout; no `any` casts except Prisma mocks in tests
- All API routes must have `try/catch` on every handler returning `{ error }` JSON with appropriate status

---

## File Structure

**New files:**
```
src/
  app/
    api/
      jobs/[jobId]/drawings/[drawingId]/
        zones/
          route.ts                          # GET list + POST zone
          [zoneId]/
            route.ts                        # GET + PATCH + DELETE zone
        zones/__tests__/
          route.test.ts                     # API tests
    jobs/[jobId]/drawings/[drawingId]/
      page.tsx                              # Server component: loads drawing + zones
  components/
    drawing-editor/
      drawing-editor.tsx                    # Client: state + layout orchestrator
      pdf-viewer.tsx                        # Client: pdfjs-dist rendering
      canvas-layer.tsx                      # Client: Konva zone shapes
      zone-panel.tsx                        # Client: zone form sidebar
  lib/
    scaffold-rules.ts                       # Pure: suggestScaffoldType()
    __tests__/
      scaffold-rules.test.ts               # Rule combination tests
```

**No modifications needed** to existing files (drawing-list.tsx already links to `/jobs/[jobId]/drawings/[drawingId]`).

---

### Task 1: Zone API Routes

**Files:**
- Create: `src/app/api/jobs/[jobId]/drawings/[drawingId]/zones/route.ts`
- Create: `src/app/api/jobs/[jobId]/drawings/[drawingId]/zones/[zoneId]/route.ts`
- Create: `src/app/api/jobs/[jobId]/drawings/[drawingId]/zones/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `prisma.drawing.findUnique`, `prisma.zone.findMany/create/findUnique/update/delete` from `@/lib/db`
- Produces:
  - `GET /api/jobs/[jobId]/drawings/[drawingId]/zones` → `Zone[]`
  - `POST /api/jobs/[jobId]/drawings/[drawingId]/zones` body → `Zone` (201)
  - `GET /api/jobs/[jobId]/drawings/[drawingId]/zones/[zoneId]` → `Zone`
  - `PATCH /api/jobs/[jobId]/drawings/[drawingId]/zones/[zoneId]` body → `Zone`
  - `DELETE /api/jobs/[jobId]/drawings/[drawingId]/zones/[zoneId]` → 204

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/jobs/[jobId]/drawings/[drawingId]/zones/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  prisma: {
    drawing: { findUnique: vi.fn() },
    zone: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { GET as getList, POST } from '../route'
import { GET as getOne, PATCH, DELETE } from '../[zoneId]/route'
import { prisma } from '@/lib/db'

const DRAWING_PARAMS = { params: Promise.resolve({ jobId: 'j1', drawingId: 'd1' }) }
const ZONE_PARAMS   = { params: Promise.resolve({ jobId: 'j1', drawingId: 'd1', zoneId: 'z1' }) }

const mockZone = {
  id: 'z1', drawingId: 'd1', pageNumber: 1, label: 'Zone A',
  canvasData: { x: 0.1, y: 0.1, width: 0.3, height: 0.2 },
  accessType: 'ground', loadingClass: 'light', heightM: 4,
  perimeterM: 20, areaM2: 16, scaffoldType: 'independent',
  templateId: null, createdAt: new Date(),
}

const validBody = {
  pageNumber: 1, label: 'Zone A',
  canvasData: { x: 0.1, y: 0.1, width: 0.3, height: 0.2 },
  accessType: 'ground', loadingClass: 'light',
  heightM: 4, perimeterM: 20, areaM2: 16,
  scaffoldType: 'independent',
}

describe('GET /zones', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns zones list with 200', async () => {
    vi.mocked(prisma.drawing.findUnique).mockResolvedValue({ id: 'd1' } as any)
    vi.mocked(prisma.zone.findMany).mockResolvedValue([mockZone] as any)
    const res = await getList(new NextRequest('http://localhost'), DRAWING_PARAMS)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
  })

  it('returns 404 when drawing not found', async () => {
    vi.mocked(prisma.drawing.findUnique).mockResolvedValue(null)
    const res = await getList(new NextRequest('http://localhost'), DRAWING_PARAMS)
    expect(res.status).toBe(404)
  })
})

describe('POST /zones', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a zone and returns 201', async () => {
    vi.mocked(prisma.drawing.findUnique).mockResolvedValue({ id: 'd1' } as any)
    vi.mocked(prisma.zone.create).mockResolvedValue(mockZone as any)
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, DRAWING_PARAMS)
    expect(res.status).toBe(201)
  })

  it('returns 400 for missing label', async () => {
    vi.mocked(prisma.drawing.findUnique).mockResolvedValue({ id: 'd1' } as any)
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ ...validBody, label: '' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, DRAWING_PARAMS)
    expect(res.status).toBe(400)
  })

  it('returns 404 when drawing not found', async () => {
    vi.mocked(prisma.drawing.findUnique).mockResolvedValue(null)
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, DRAWING_PARAMS)
    expect(res.status).toBe(404)
  })
})

describe('GET /zones/[zoneId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns zone with 200', async () => {
    vi.mocked(prisma.zone.findUnique).mockResolvedValue({ ...mockZone, estimateItems: [] } as any)
    const res = await getOne(new NextRequest('http://localhost'), ZONE_PARAMS)
    expect(res.status).toBe(200)
  })

  it('returns 404 for unknown zone', async () => {
    vi.mocked(prisma.zone.findUnique).mockResolvedValue(null)
    const res = await getOne(new NextRequest('http://localhost'), ZONE_PARAMS)
    expect(res.status).toBe(404)
  })
})

describe('PATCH /zones/[zoneId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates zone and returns 200', async () => {
    vi.mocked(prisma.zone.update).mockResolvedValue({ ...mockZone, label: 'Zone B' } as any)
    const req = new NextRequest('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ label: 'Zone B' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, ZONE_PARAMS)
    expect(res.status).toBe(200)
  })

  it('returns 404 for unknown zone (P2025)', async () => {
    const err = Object.assign(new Error('not found'), { code: 'P2025' })
    vi.mocked(prisma.zone.update).mockRejectedValue(err)
    const req = new NextRequest('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ label: 'X' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, ZONE_PARAMS)
    expect(res.status).toBe(404)
  })
})

describe('DELETE /zones/[zoneId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes zone and returns 204', async () => {
    vi.mocked(prisma.zone.delete).mockResolvedValue(mockZone as any)
    const res = await DELETE(new NextRequest('http://localhost'), ZONE_PARAMS)
    expect(res.status).toBe(204)
  })

  it('returns 404 for unknown zone (P2025)', async () => {
    const err = Object.assign(new Error('not found'), { code: 'P2025' })
    vi.mocked(prisma.zone.delete).mockRejectedValue(err)
    const res = await DELETE(new NextRequest('http://localhost'), ZONE_PARAMS)
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/app/api/jobs
```
Expected: compilation errors ("Cannot find module '../route'")

- [ ] **Step 3: Create the zones list route**

Create `src/app/api/jobs/[jobId]/drawings/[drawingId]/zones/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const zoneSchema = z.object({
  pageNumber: z.number().int().min(1).default(1),
  label: z.string().min(1),
  canvasData: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  }),
  accessType: z.enum(['ground', 'elevated', 'confined', 'overhead']),
  loadingClass: z.enum(['light', 'medium', 'heavy']),
  heightM: z.number().positive(),
  perimeterM: z.number().positive(),
  areaM2: z.number().positive(),
  scaffoldType: z.enum(['independent', 'birdcage', 'putlog', 'suspended', 'cantilever']),
  templateId: z.string().nullable().optional(),
})

type Params = { params: Promise<{ jobId: string; drawingId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { drawingId } = await params
    const drawing = await prisma.drawing.findUnique({ where: { id: drawingId }, select: { id: true } })
    if (!drawing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const zones = await prisma.zone.findMany({ where: { drawingId }, orderBy: { createdAt: 'asc' } })
    return NextResponse.json(zones)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { drawingId } = await params
    const drawing = await prisma.drawing.findUnique({ where: { id: drawingId }, select: { id: true } })
    if (!drawing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = await request.json()
    const result = zoneSchema.safeParse(body)
    if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
    const zone = await prisma.zone.create({ data: { drawingId, ...result.data } })
    return NextResponse.json(zone, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Create the zone item route**

Create `src/app/api/jobs/[jobId]/drawings/[drawingId]/zones/[zoneId]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const patchSchema = z.object({
  pageNumber: z.number().int().min(1).optional(),
  label: z.string().min(1).optional(),
  canvasData: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  }).optional(),
  accessType: z.enum(['ground', 'elevated', 'confined', 'overhead']).optional(),
  loadingClass: z.enum(['light', 'medium', 'heavy']).optional(),
  heightM: z.number().positive().optional(),
  perimeterM: z.number().positive().optional(),
  areaM2: z.number().positive().optional(),
  scaffoldType: z.enum(['independent', 'birdcage', 'putlog', 'suspended', 'cantilever']).optional(),
  templateId: z.string().nullable().optional(),
})

type Params = { params: Promise<{ jobId: string; drawingId: string; zoneId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { zoneId } = await params
    const zone = await prisma.zone.findUnique({ where: { id: zoneId }, include: { estimateItems: true } })
    if (!zone) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(zone)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { zoneId } = await params
    const body = await request.json()
    const result = patchSchema.safeParse(body)
    if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
    try {
      const zone = await prisma.zone.update({ where: { id: zoneId }, data: result.data })
      return NextResponse.json(zone)
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
      throw e
    }
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { zoneId } = await params
    try {
      await prisma.zone.delete({ where: { id: zoneId } })
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
      throw e
    }
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/app/api/jobs
```
Expected: all 9 new zone tests pass, plus previously passing tests unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/jobs/[jobId]/drawings/[drawingId]/zones/
git commit -m "feat: add zone API routes (GET list, POST, GET one, PATCH, DELETE)"
```

---

### Task 2: Scaffold Type Suggestion

**Files:**
- Create: `src/lib/scaffold-rules.ts`
- Create: `src/lib/__tests__/scaffold-rules.test.ts`

**Interfaces:**
- Produces: `suggestScaffoldType(accessType: AccessType, loadingClass: LoadingClass): ScaffoldType` — used by `zone-panel.tsx` in Task 5

The rules from the spec:
| Access Type | Loading Class   | Scaffold Type  |
|-------------|-----------------|----------------|
| ground      | light / medium  | independent    |
| ground      | heavy           | birdcage       |
| elevated    | any             | cantilever     |
| overhead    | any             | suspended      |
| confined    | any             | birdcage       |

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/scaffold-rules.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { suggestScaffoldType } from '../scaffold-rules'

describe('suggestScaffoldType', () => {
  it('ground + light → independent', () => {
    expect(suggestScaffoldType('ground', 'light')).toBe('independent')
  })
  it('ground + medium → independent', () => {
    expect(suggestScaffoldType('ground', 'medium')).toBe('independent')
  })
  it('ground + heavy → birdcage', () => {
    expect(suggestScaffoldType('ground', 'heavy')).toBe('birdcage')
  })
  it('elevated + light → cantilever', () => {
    expect(suggestScaffoldType('elevated', 'light')).toBe('cantilever')
  })
  it('elevated + heavy → cantilever', () => {
    expect(suggestScaffoldType('elevated', 'heavy')).toBe('cantilever')
  })
  it('overhead + any → suspended', () => {
    expect(suggestScaffoldType('overhead', 'medium')).toBe('suspended')
  })
  it('confined + any → birdcage', () => {
    expect(suggestScaffoldType('confined', 'light')).toBe('birdcage')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib
```
Expected: FAIL with "Cannot find module '../scaffold-rules'"

- [ ] **Step 3: Implement the function**

Create `src/lib/scaffold-rules.ts`:

```ts
import type { AccessType, LoadingClass, ScaffoldType } from '@prisma/client'

export function suggestScaffoldType(
  accessType: AccessType,
  loadingClass: LoadingClass,
): ScaffoldType {
  if (accessType === 'elevated') return 'cantilever'
  if (accessType === 'overhead') return 'suspended'
  if (accessType === 'confined') return 'birdcage'
  // ground
  return loadingClass === 'heavy' ? 'birdcage' : 'independent'
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib
```
Expected: 7/7 passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/scaffold-rules.ts src/lib/__tests__/scaffold-rules.test.ts
git commit -m "feat: add scaffold type suggestion rules"
```

---

### Task 3: PDF Viewer Component

**Files:**
- Create: `src/components/drawing-editor/pdf-viewer.tsx`

**Interfaces:**
- Consumes: nothing from prior tasks
- Produces:
  ```ts
  export default function PdfViewer(props: {
    blobUrl: string
    page: number
    onPageCount: (n: number) => void
    onRenderSize: (w: number, h: number) => void
  }): JSX.Element
  ```
  Renders a `<canvas>` with the PDF page at 1.5× scale. Calls `onPageCount` after loading, `onRenderSize` after each render. Shows a loading overlay and an error overlay.

No unit tests for this task — PDF rendering requires a real browser and a valid PDF URL.

- [ ] **Step 1: Install pdfjs-dist**

```bash
npm install pdfjs-dist
```

Verify it's in package.json dependencies:
```bash
grep '"pdfjs-dist"' package.json
```
Expected: `"pdfjs-dist": "^X.Y.Z"`

- [ ] **Step 2: Create the PDF viewer component**

Create `src/components/drawing-editor/pdf-viewer.tsx`:

```tsx
'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

type Props = {
  blobUrl: string
  page: number
  onPageCount: (n: number) => void
  onRenderSize: (w: number, h: number) => void
}

export default function PdfViewer({ blobUrl, page, onPageCount, onRenderSize }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const stableOnPageCount = useCallback(onPageCount, [])
  const stableOnRenderSize = useCallback(onRenderSize, [])

  useEffect(() => {
    let cancelled = false
    setStatus('loading')

    async function render() {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

        const pdf = await pdfjsLib.getDocument(blobUrl).promise
        if (cancelled) return
        stableOnPageCount(pdf.numPages)

        const pdfPage = await pdf.getPage(page)
        if (cancelled) return

        const viewport = pdfPage.getViewport({ scale: 1.5 })
        const canvas = canvasRef.current
        if (!canvas || cancelled) return

        canvas.width = viewport.width
        canvas.height = viewport.height
        stableOnRenderSize(viewport.width, viewport.height)

        const ctx = canvas.getContext('2d')!
        await pdfPage.render({ canvasContext: ctx, viewport }).promise

        if (!cancelled) setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    render()
    return () => { cancelled = true }
  }, [blobUrl, page, stableOnPageCount, stableOnRenderSize])

  return (
    <div className="relative inline-block">
      <canvas ref={canvasRef} style={{ display: 'block' }} />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70">
          <span className="text-sm text-muted-foreground">Loading PDF…</span>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70">
          <span className="text-sm text-destructive">Could not load PDF</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/drawing-editor/pdf-viewer.tsx package.json package-lock.json
git commit -m "feat: add PDF viewer component (pdfjs-dist)"
```

---

### Task 4: Canvas Annotation Layer

**Files:**
- Create: `src/components/drawing-editor/canvas-layer.tsx`

**Interfaces:**
- Consumes: nothing from prior tasks (standalone Konva component)
- Produces:
  ```ts
  export type CanvasRect = { x: number; y: number; width: number; height: number }

  export type ZoneOverlay = {
    id: string
    label: string
    canvasData: CanvasRect
    selected: boolean
  }

  export default function CanvasLayer(props: {
    width: number
    height: number
    zones: ZoneOverlay[]
    onDraftComplete: (rect: CanvasRect) => void
    onSelectZone: (id: string) => void
  }): JSX.Element
  ```
  Renders a Konva Stage at `width × height` (positioned absolutely). Clicking on an existing zone rect selects it. Dragging on empty space draws a new rect; on mouse-up, calls `onDraftComplete` with the normalized (0–1) rect if its size exceeds 1% of both dimensions. Zones are rendered green; selected zone is darker green.

No unit tests — Konva requires a DOM canvas environment.

- [ ] **Step 1: Install Konva packages**

```bash
npm install konva react-konva
```

Verify:
```bash
grep '"konva"\|"react-konva"' package.json
```
Expected: both present

- [ ] **Step 2: Create the canvas layer component**

Create `src/components/drawing-editor/canvas-layer.tsx`:

```tsx
'use client'
import { useState, useRef } from 'react'
import { Stage, Layer, Rect, Text } from 'react-konva'
import type Konva from 'konva'

export type CanvasRect = { x: number; y: number; width: number; height: number }

export type ZoneOverlay = {
  id: string
  label: string
  canvasData: CanvasRect
  selected: boolean
}

type Props = {
  width: number
  height: number
  zones: ZoneOverlay[]
  onDraftComplete: (rect: CanvasRect) => void
  onSelectZone: (id: string) => void
}

export default function CanvasLayer({ width, height, zones, onDraftComplete, onSelectZone }: Props) {
  const [draft, setDraft] = useState<CanvasRect | null>(null)
  const isDrawing = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })

  function toFrac(val: number, max: number) {
    return max > 0 ? val / max : 0
  }

  function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    // Only start drawing on empty stage area, not on zone rects
    if (e.target !== e.target.getStage()) return
    const pos = e.target.getStage()!.getPointerPosition()!
    isDrawing.current = true
    startPos.current = pos
    setDraft({ x: toFrac(pos.x, width), y: toFrac(pos.y, height), width: 0, height: 0 })
  }

  function handleMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    if (!isDrawing.current) return
    const pos = e.target.getStage()!.getPointerPosition()!
    const sx = startPos.current.x
    const sy = startPos.current.y
    setDraft({
      x: toFrac(Math.min(pos.x, sx), width),
      y: toFrac(Math.min(pos.y, sy), height),
      width: toFrac(Math.abs(pos.x - sx), width),
      height: toFrac(Math.abs(pos.y - sy), height),
    })
  }

  function handleMouseUp() {
    if (!isDrawing.current || !draft) return
    isDrawing.current = false
    if (draft.width > 0.01 && draft.height > 0.01) {
      onDraftComplete(draft)
    }
    setDraft(null)
  }

  return (
    <Stage
      width={width}
      height={height}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ position: 'absolute', top: 0, left: 0, cursor: 'crosshair' }}
    >
      <Layer>
        {zones.map((z) => (
          <React.Fragment key={z.id}>
            <Rect
              x={z.canvasData.x * width}
              y={z.canvasData.y * height}
              width={z.canvasData.width * width}
              height={z.canvasData.height * height}
              fill={z.selected ? 'rgba(0,140,62,0.4)' : 'rgba(0,180,81,0.2)'}
              stroke={z.selected ? '#008C3E' : '#00B451'}
              strokeWidth={z.selected ? 2 : 1}
              onClick={() => onSelectZone(z.id)}
              onMouseEnter={(e) => { const stage = e.target.getStage(); if (stage) stage.container().style.cursor = 'pointer' }}
              onMouseLeave={(e) => { const stage = e.target.getStage(); if (stage) stage.container().style.cursor = 'crosshair' }}
            />
            <Text
              x={z.canvasData.x * width + 4}
              y={z.canvasData.y * height + 4}
              text={z.label}
              fontSize={12}
              fill="#0D1B2A"
              listening={false}
            />
          </React.Fragment>
        ))}
        {draft && draft.width > 0 && (
          <Rect
            x={draft.x * width}
            y={draft.y * height}
            width={draft.width * width}
            height={draft.height * height}
            fill="rgba(0,180,81,0.1)"
            stroke="#00B451"
            strokeWidth={1}
            dash={[6, 3]}
            listening={false}
          />
        )}
      </Layer>
    </Stage>
  )
}
```

Note: `React.Fragment` requires adding `import React from 'react'` at the top. The full file imports:

```tsx
'use client'
import React, { useState, useRef } from 'react'
import { Stage, Layer, Rect, Text } from 'react-konva'
import type Konva from 'konva'
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors (if react-konva types are missing, install `@types/react-konva` — but they're bundled with react-konva v18+)

- [ ] **Step 4: Commit**

```bash
git add src/components/drawing-editor/canvas-layer.tsx package.json package-lock.json
git commit -m "feat: add Konva canvas annotation layer"
```

---

### Task 5: Zone Panel Form

**Files:**
- Create: `src/components/drawing-editor/zone-panel.tsx`

**Interfaces:**
- Consumes:
  - `suggestScaffoldType` from `@/lib/scaffold-rules` (Task 2)
  - `CanvasRect` type from `./canvas-layer` (Task 4)
- Produces:
  ```ts
  export type ZoneFormValues = {
    label: string
    accessType: 'ground' | 'elevated' | 'confined' | 'overhead'
    loadingClass: 'light' | 'medium' | 'heavy'
    heightM: number
    perimeterM: number
    areaM2: number
    scaffoldType: 'independent' | 'birdcage' | 'putlog' | 'suspended' | 'cantilever'
    templateId: string | null
  }

  export default function ZonePanel(props: {
    mode: 'new' | 'edit'
    initialValues?: Partial<ZoneFormValues>
    onSave: (values: ZoneFormValues) => Promise<void>
    onDelete?: () => Promise<void>
    onClose: () => void
  }): JSX.Element
  ```

No unit tests — form interaction requires browser.

- [ ] **Step 1: Create zone-panel.tsx**

Create `src/components/drawing-editor/zone-panel.tsx`:

```tsx
'use client'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { suggestScaffoldType } from '@/lib/scaffold-rules'

export type ZoneFormValues = {
  label: string
  accessType: 'ground' | 'elevated' | 'confined' | 'overhead'
  loadingClass: 'light' | 'medium' | 'heavy'
  heightM: number
  perimeterM: number
  areaM2: number
  scaffoldType: 'independent' | 'birdcage' | 'putlog' | 'suspended' | 'cantilever'
  templateId: string | null
}

type Props = {
  mode: 'new' | 'edit'
  initialValues?: Partial<ZoneFormValues>
  onSave: (values: ZoneFormValues) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

const FIELD_CLASS = 'w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
const LABEL_CLASS = 'block text-xs font-medium text-muted-foreground mb-1'

export default function ZonePanel({ mode, initialValues, onSave, onDelete, onClose }: Props) {
  const { register, handleSubmit, watch, setValue, formState: { isSubmitting, errors } } = useForm<ZoneFormValues>({
    defaultValues: {
      label: '',
      accessType: 'ground',
      loadingClass: 'light',
      heightM: 0,
      perimeterM: 0,
      areaM2: 0,
      scaffoldType: 'independent',
      templateId: null,
      ...initialValues,
    },
  })

  const accessType = watch('accessType')
  const loadingClass = watch('loadingClass')

  // Auto-suggest scaffold type when access type or loading class changes
  useEffect(() => {
    setValue('scaffoldType', suggestScaffoldType(accessType, loadingClass), { shouldDirty: false })
  }, [accessType, loadingClass, setValue])

  async function handleDelete() {
    if (!onDelete) return
    await onDelete()
  }

  return (
    <aside
      className="w-72 flex-shrink-0 flex flex-col border-l border-border bg-card overflow-y-auto"
      style={{ minHeight: 0 }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">{mode === 'new' ? 'New Zone' : 'Edit Zone'}</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
      </div>

      <form onSubmit={handleSubmit(onSave)} className="flex flex-col gap-4 p-4 flex-1">
        <div>
          <label className={LABEL_CLASS}>Label *</label>
          <input {...register('label', { required: true })} className={FIELD_CLASS} placeholder="e.g. Zone A" />
          {errors.label && <p className="text-xs text-destructive mt-1">Required</p>}
        </div>

        <div>
          <label className={LABEL_CLASS}>Access Type</label>
          <select {...register('accessType')} className={FIELD_CLASS}>
            <option value="ground">Ground</option>
            <option value="elevated">Elevated</option>
            <option value="confined">Confined</option>
            <option value="overhead">Overhead</option>
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS}>Loading Class</label>
          <select {...register('loadingClass')} className={FIELD_CLASS}>
            <option value="light">Light</option>
            <option value="medium">Medium</option>
            <option value="heavy">Heavy</option>
          </select>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={LABEL_CLASS}>Height (m)</label>
            <input type="number" step="0.1" min="0" {...register('heightM', { valueAsNumber: true, min: 0.01 })} className={FIELD_CLASS} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Perimeter (m)</label>
            <input type="number" step="0.1" min="0" {...register('perimeterM', { valueAsNumber: true, min: 0.01 })} className={FIELD_CLASS} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Area (m²)</label>
            <input type="number" step="0.1" min="0" {...register('areaM2', { valueAsNumber: true, min: 0.01 })} className={FIELD_CLASS} />
          </div>
        </div>

        <div>
          <label className={LABEL_CLASS}>Scaffold Type <span className="text-muted-foreground">(auto-suggested)</span></label>
          <select {...register('scaffoldType')} className={FIELD_CLASS}>
            <option value="independent">Independent</option>
            <option value="birdcage">Birdcage</option>
            <option value="putlog">Putlog</option>
            <option value="suspended">Suspended</option>
            <option value="cantilever">Cantilever</option>
          </select>
        </div>

        <div className="flex gap-2 mt-auto pt-2">
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? 'Saving…' : 'Save Zone'}
          </Button>
          {mode === 'edit' && onDelete && (
            <Button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              style={{ background: 'var(--destructive)', color: '#fff' }}
            >
              Delete
            </Button>
          )}
        </div>
      </form>
    </aside>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/drawing-editor/zone-panel.tsx
git commit -m "feat: add zone panel form with scaffold type auto-suggestion"
```

---

### Task 6: Drawing Editor Orchestrator + Page

**Files:**
- Create: `src/components/drawing-editor/drawing-editor.tsx`
- Create: `src/app/jobs/[jobId]/drawings/[drawingId]/page.tsx`

**Interfaces:**
- Consumes:
  - `PdfViewer` from `./pdf-viewer` (Task 3) — dynamic import
  - `CanvasLayer`, `CanvasRect`, `ZoneOverlay` from `./canvas-layer` (Task 4) — dynamic import
  - `ZonePanel`, `ZoneFormValues` from `./zone-panel` (Task 5)
  - Zone API routes from Task 1 via `fetch`
  - Prisma `drawing` + `zone` queries in the server page

**DrawingEditor state:**
- `zones: Zone[]` — synced with API
- `selectedZoneId: string | null`
- `draftRect: CanvasRect | null` — new zone shape before saving
- `currentPage: number`
- `totalPages: number`
- `renderWidth / renderHeight: number` — set by PdfViewer callback

**Panel behavior:**
- When `draftRect` is set → panel opens in `'new'` mode
- When `selectedZoneId` is set → panel opens in `'edit'` mode with that zone's values
- Closing the panel clears both `draftRect` and `selectedZoneId`

No new unit tests in this task — Zone API tests are in Task 1; UI is tested by loading the page in the dev server.

- [ ] **Step 1: Create the drawing editor orchestrator**

Create `src/components/drawing-editor/drawing-editor.tsx`:

```tsx
'use client'
import dynamic from 'next/dynamic'
import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import ZonePanel, { ZoneFormValues } from './zone-panel'
import type { CanvasRect, ZoneOverlay } from './canvas-layer'

const PdfViewer = dynamic(() => import('./pdf-viewer'), { ssr: false })
const CanvasLayer = dynamic(() => import('./canvas-layer'), { ssr: false })

type Zone = {
  id: string
  drawingId: string
  pageNumber: number
  label: string
  canvasData: CanvasRect
  accessType: 'ground' | 'elevated' | 'confined' | 'overhead'
  loadingClass: 'light' | 'medium' | 'heavy'
  heightM: number
  perimeterM: number
  areaM2: number
  scaffoldType: 'independent' | 'birdcage' | 'putlog' | 'suspended' | 'cantilever'
  templateId: string | null
  createdAt: string
}

type Drawing = {
  id: string
  jobId: string
  structureId: string
  structureName: string
  filename: string
  blobUrl: string
  pageCount: number
}

type Props = {
  drawing: Drawing
  initialZones: Zone[]
}

export default function DrawingEditor({ drawing, initialZones }: Props) {
  const [zones, setZones] = useState<Zone[]>(initialZones)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(drawing.pageCount)
  const [renderWidth, setRenderWidth] = useState(0)
  const [renderHeight, setRenderHeight] = useState(0)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [draftRect, setDraftRect] = useState<CanvasRect | null>(null)

  const handlePageCount = useCallback((n: number) => setTotalPages(n), [])
  const handleRenderSize = useCallback((w: number, h: number) => {
    setRenderWidth(w)
    setRenderHeight(h)
  }, [])

  const pageZones: ZoneOverlay[] = zones
    .filter((z) => z.pageNumber === currentPage)
    .map((z) => ({ id: z.id, label: z.label, canvasData: z.canvasData, selected: z.id === selectedZoneId }))

  function handleDraftComplete(rect: CanvasRect) {
    setSelectedZoneId(null)
    setDraftRect(rect)
  }

  function handleSelectZone(id: string) {
    setDraftRect(null)
    setSelectedZoneId(id)
  }

  function closePanel() {
    setDraftRect(null)
    setSelectedZoneId(null)
  }

  const selectedZone = selectedZoneId ? zones.find((z) => z.id === selectedZoneId) : null

  const panelMode: 'new' | 'edit' | null =
    draftRect ? 'new' : selectedZone ? 'edit' : null

  async function handleSave(values: ZoneFormValues) {
    if (draftRect) {
      // Create new zone
      const res = await fetch(`/api/jobs/${drawing.jobId}/drawings/${drawing.id}/zones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageNumber: currentPage,
          canvasData: draftRect,
          ...values,
        }),
      })
      if (!res.ok) throw new Error('Failed to save zone')
      const newZone: Zone = await res.json()
      setZones((prev) => [...prev, newZone])
      setDraftRect(null)
      setSelectedZoneId(newZone.id)
    } else if (selectedZone) {
      // Update existing zone
      const res = await fetch(
        `/api/jobs/${drawing.jobId}/drawings/${drawing.id}/zones/${selectedZone.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        },
      )
      if (!res.ok) throw new Error('Failed to update zone')
      const updated: Zone = await res.json()
      setZones((prev) => prev.map((z) => (z.id === updated.id ? updated : z)))
    }
  }

  async function handleDelete() {
    if (!selectedZone) return
    const res = await fetch(
      `/api/jobs/${drawing.jobId}/drawings/${drawing.id}/zones/${selectedZone.id}`,
      { method: 'DELETE' },
    )
    if (!res.ok) throw new Error('Failed to delete zone')
    setZones((prev) => prev.filter((z) => z.id !== selectedZone.id))
    setSelectedZoneId(null)
  }

  const panelInitialValues: Partial<ZoneFormValues> | undefined = selectedZone
    ? {
        label: selectedZone.label,
        accessType: selectedZone.accessType,
        loadingClass: selectedZone.loadingClass,
        heightM: selectedZone.heightM,
        perimeterM: selectedZone.perimeterM,
        areaM2: selectedZone.areaM2,
        scaffoldType: selectedZone.scaffoldType,
        templateId: selectedZone.templateId,
      }
    : undefined

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b border-border flex-shrink-0 bg-card"
      >
        <div>
          <span className="text-sm font-medium">{drawing.filename}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            {drawing.structureName} ({drawing.structureId})
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {zones.filter((z) => z.pageNumber === currentPage).length} zone{zones.length !== 1 ? 's' : ''} on page
          </span>
          {/* Page navigation */}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              style={{ padding: '2px 8px', fontSize: 12 }}
            >
              ‹
            </Button>
            <span className="text-xs text-muted-foreground w-16 text-center">
              {currentPage} / {totalPages}
            </span>
            <Button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              style={{ padding: '2px 8px', fontSize: 12 }}
            >
              ›
            </Button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 overflow-auto bg-muted p-4">
          <div className="relative inline-block" style={{ minWidth: renderWidth || 'auto' }}>
            <PdfViewer
              blobUrl={drawing.blobUrl}
              page={currentPage}
              onPageCount={handlePageCount}
              onRenderSize={handleRenderSize}
            />
            {renderWidth > 0 && renderHeight > 0 && (
              <CanvasLayer
                width={renderWidth}
                height={renderHeight}
                zones={pageZones}
                onDraftComplete={handleDraftComplete}
                onSelectZone={handleSelectZone}
              />
            )}
          </div>
        </div>

        {/* Zone panel */}
        {panelMode && (
          <ZonePanel
            key={selectedZoneId ?? 'new'}
            mode={panelMode}
            initialValues={panelInitialValues}
            onSave={handleSave}
            onDelete={panelMode === 'edit' ? handleDelete : undefined}
            onClose={closePanel}
          />
        )}
      </div>

      {/* Footer hint */}
      {!panelMode && (
        <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border bg-card flex-shrink-0">
          Drag on the PDF to draw a new zone · Click an existing zone to edit it
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create the drawing editor page**

Create `src/app/jobs/[jobId]/drawings/[drawingId]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import dynamic from 'next/dynamic'
import { prisma } from '@/lib/db'

const DrawingEditor = dynamic(
  () => import('@/components/drawing-editor/drawing-editor'),
  { ssr: false },
)

export default async function DrawingEditorPage({
  params,
}: {
  params: Promise<{ jobId: string; drawingId: string }>
}) {
  const { drawingId } = await params

  let drawing
  let zones: Awaited<ReturnType<typeof prisma.zone.findMany>> = []
  try {
    drawing = await prisma.drawing.findUnique({ where: { id: drawingId } })
    if (drawing) {
      zones = await prisma.zone.findMany({
        where: { drawingId },
        orderBy: { createdAt: 'asc' },
      })
    }
  } catch {
    // DB not yet connected — show empty editor
  }

  if (!drawing) notFound()

  const drawingData = {
    id: drawing.id,
    jobId: drawing.jobId,
    structureId: drawing.structureId,
    structureName: drawing.structureName,
    filename: drawing.filename,
    blobUrl: drawing.blobUrl,
    pageCount: drawing.pageCount,
  }

  const zonesData = zones.map((z) => ({
    id: z.id,
    drawingId: z.drawingId,
    pageNumber: z.pageNumber,
    label: z.label,
    canvasData: z.canvasData as { x: number; y: number; width: number; height: number },
    accessType: z.accessType,
    loadingClass: z.loadingClass,
    heightM: z.heightM,
    perimeterM: z.perimeterM,
    areaM2: z.areaM2,
    scaffoldType: z.scaffoldType,
    templateId: z.templateId,
    createdAt: z.createdAt.toISOString(),
  }))

  return <DrawingEditor drawing={drawingData} initialZones={zonesData} />
}
```

- [ ] **Step 3: Update root layout to allow full-height editor**

The drawing editor needs `h-full` to work inside the layout. The root layout in `src/app/layout.tsx` already has `h-dvh overflow-hidden` on the wrapper — no changes needed. The editor page itself returns a full-height component.

However, verify `src/app/layout.tsx` has this structure:

```tsx
<body className={`${inter.className} flex flex-col lg:flex-row min-h-screen`}>
  <Nav />
  <main className="flex-1 p-6 overflow-auto">{children}</main>
</body>
```

For the drawing editor, `p-6` on `<main>` will add unwanted padding. The editor needs to fill the whole content area. Add a special case: if the page is the drawing editor, we skip the normal padding.

The cleanest approach without modifying layout is to use negative margins on the editor to break out of the padding. Instead, modify `src/app/layout.tsx` to remove padding from `<main>` and let each page control its own spacing:

Modify `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/nav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'NMDC Energy | Scaffolding',
  description: 'Internal scaffolding design and estimation tool',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex flex-col lg:flex-row h-dvh overflow-hidden" style={{ background: 'var(--bg, var(--background))' }}>
          <Nav />
          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
      </body>
    </html>
  )
}
```

Now each page is responsible for its own padding (e.g. `src/app/jobs/page.tsx` wraps its content in `<div className="p-6">`).

- [ ] **Step 4: Update jobs page to add padding**

Since main no longer has padding, add it explicitly in `src/app/jobs/page.tsx`:

```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { JobList } from '@/components/jobs/job-list'
import { prisma } from '@/lib/db'

export default async function JobsPage() {
  let jobs: Awaited<ReturnType<typeof prisma.job.findMany>> = []
  try {
    jobs = await prisma.job.findMany({
      include: { _count: { select: { drawings: true } } },
      orderBy: { createdAt: 'desc' },
    })
  } catch {
    // DB not yet connected (local dev) — show empty state
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Jobs</h1>
        <Button render={<Link href="/jobs/new" />}>New Job</Button>
      </div>
      <JobList jobs={jobs} />
    </div>
  )
}
```

Similarly update `src/app/jobs/new/page.tsx` and `src/app/jobs/[jobId]/page.tsx` to wrap content in `<div className="p-6 overflow-auto h-full">`.

- [ ] **Step 5: Update new job page and job detail page**

Read and update `src/app/jobs/new/page.tsx` — wrap its return in `<div className="p-6 overflow-auto h-full">`.

Read and update `src/app/jobs/[jobId]/page.tsx` — wrap its return in `<div className="p-6 overflow-auto h-full">`.

- [ ] **Step 6: Run all tests**

```bash
npm test -- --run
```
Expected: all previously passing tests still pass (13+9 zone tests +7 scaffold tests = 29 total). The layout changes affect no API or logic tests.

- [ ] **Step 7: Commit**

```bash
git add \
  src/components/drawing-editor/drawing-editor.tsx \
  src/app/jobs/[jobId]/drawings/[drawingId]/page.tsx \
  src/app/layout.tsx \
  src/app/jobs/page.tsx \
  src/app/jobs/new/page.tsx \
  src/app/jobs/[jobId]/page.tsx
git commit -m "feat: drawing editor page with PDF viewer, zone canvas, and zone panel"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| PDF page rendered via PDF.js | Task 3: `pdf-viewer.tsx` |
| Konva.js canvas overlay for drawing zones (rectangle) | Task 4: `canvas-layer.tsx` |
| Zone Panel: label, access type, loading class | Task 5: `zone-panel.tsx` |
| Zone Panel: height, perimeter, area inputs | Task 5: `zone-panel.tsx` |
| Zone Panel: auto-suggested scaffold type | Task 2 (rules) + Task 5 (useEffect watcher) |
| Zones shown as colour-coded overlays with labels | Task 4: green Konva Rects + Text |
| Page navigation for multi-page PDFs | Task 6: DrawingEditor page header |
| Navigate to Drawing Editor per drawing | drawing-list.tsx already links `/jobs/[jobId]/drawings/[drawingId]` |
| Zone CRUD API | Task 1: zones route + [zoneId] route |

**Out of scope for Plan 2 (deferred to Plan 3):**
- Template selector (needs template CRUD from Plan 3)
- "Generate Estimate" button (needs estimation engine from Plan 3)
- Zone polygon drawing (rectangle only in Plan 2 — polygon is a Plan 3 enhancement)

**Placeholder scan:** None found.

**Type consistency:**
- `CanvasRect` defined in `canvas-layer.tsx`, imported by `drawing-editor.tsx` ✓
- `ZoneFormValues` defined in `zone-panel.tsx`, imported by `drawing-editor.tsx` ✓
- `ZoneOverlay` defined in `canvas-layer.tsx`, used in `drawing-editor.tsx` ✓
- `suggestScaffoldType` signature in `scaffold-rules.ts` matches usage in `zone-panel.tsx` ✓
