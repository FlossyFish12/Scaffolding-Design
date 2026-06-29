# Estimation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Estimation Engine — template CRUD API, formula-based estimate item generation, zone panel wiring, and an editable Estimate Sheet page.

**Architecture:** A `Template` holds formula-based line items; when the user clicks "Generate Estimate" in the Drawing Editor's ZonePanel, the API matches the zone to a template, evaluates each formula against zone dimensions, and upserts `EstimateItem` rows (preserving any manually overridden items). The Estimate Sheet page renders all estimate items for a job grouped by structure, with inline editing that PATCH-es individual items and marks them `overridden: true`.

**Tech Stack:**
- Next.js 16.2.9 App Router
- Prisma v7 with `@prisma/adapter-pg`
- `zod` — API request validation
- `react-hook-form` — already in zone panel
- Vitest v4.1.9 — tests

## Global Constraints

- **Next.js 16.2.9**: route `params` are `Promise<{...}>` — always `await params`
- **Prisma v7**: `import { PrismaClient } from '@prisma/client'`; enum types as `import type { ... } from '@prisma/client'`; `import { Prisma } from '@prisma/client'` for `PrismaClientKnownRequestError`
- **shadcn/ui v4.12.0**: Button uses `render` prop, NOT `asChild`
- **Vitest v4.1.9**: constructor mocks require `vi.fn(function() { return {...} })`, NOT arrow functions
- **TypeScript strict mode**: no `any`; use `unknown` + Zod parse for request bodies
- **All API routes**: inner `try { body = await req.json() } catch { return 400 }` before outer catch for DB errors
- **NMDC brand tokens**: `--green: #00B451`, `--navy: #0D1B2A`, `--background: #F2F5F9`
- **P2025 → 404**: catch `Prisma.PrismaClientKnownRequestError` with `e.code === 'P2025'` and return 404

## File Map

```
src/
  app/
    api/
      templates/
        route.ts                                         CREATE  GET list, POST
        [templateId]/
          route.ts                                       CREATE  GET one, PATCH, DELETE
          line-items/
            route.ts                                     CREATE  POST
            [lineItemId]/
              route.ts                                   CREATE  PATCH, DELETE
      jobs/[jobId]/drawings/[drawingId]/zones/[zoneId]/
        estimate/
          route.ts                                       CREATE  POST (generate)
        estimate-items/
          [itemId]/
            route.ts                                     CREATE  PATCH (override)
    jobs/
      [jobId]/
        estimate/
          page.tsx                                       CREATE  Estimate Sheet server page
        page.tsx                                         MODIFY  add "View Estimate" link
  lib/
    estimate-engine.ts                                   CREATE  formula evaluator + item generator
    __tests__/
      estimate-engine.test.ts                            CREATE  unit tests
  components/
    estimate/
      estimate-sheet.tsx                                 CREATE  client component (editable table)
    drawing-editor/
      zone-panel.tsx                                     MODIFY  add template selector + Generate button
      drawing-editor.tsx                                 MODIFY  fetch templates, pass to panel, handle generate
```

---

### Task 1: Template API Routes

**Files:**
- Create: `src/app/api/templates/route.ts`
- Create: `src/app/api/templates/[templateId]/route.ts`
- Create: `src/app/api/templates/[templateId]/line-items/route.ts`
- Create: `src/app/api/templates/[templateId]/line-items/[lineItemId]/route.ts`
- Test: `src/app/api/templates/__tests__/route.test.ts`

**Interfaces:**
- Produces: `GET /api/templates` → `{ id, name, scaffoldType, accessTypes, loadingClasses, _count: { lineItems } }[]`
- Produces: `GET /api/templates/[id]` → template with `lineItems[]`
- Produces: `POST /api/templates` → 201 with created template
- Produces: `POST /api/templates/[id]/line-items` → 201 with created line item

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/templates/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const mockPrisma = {
  template: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  templateLineItem: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

import { GET as getTemplates, POST as postTemplate } from '../route'
import { GET as getTemplate, PATCH as patchTemplate, DELETE as deleteTemplate } from '../[templateId]/route'
import { POST as postLineItem } from '../[templateId]/line-items/route'
import { PATCH as patchLineItem, DELETE as deleteLineItem } from '../[templateId]/line-items/[lineItemId]/route'

const makeReq = (body?: unknown) =>
  new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

const tplParams = (templateId = 'tpl-1') =>
  ({ params: Promise.resolve({ templateId }) } as { params: Promise<{ templateId: string }> })

const liParams = (templateId = 'tpl-1', lineItemId = 'li-1') =>
  ({ params: Promise.resolve({ templateId, lineItemId }) } as { params: Promise<{ templateId: string; lineItemId: string }> })

beforeEach(() => vi.clearAllMocks())

const TEMPLATE = {
  id: 'tpl-1',
  name: 'Standard Independent',
  scaffoldType: 'independent',
  accessTypes: ['ground'],
  loadingClasses: ['light', 'medium'],
  _count: { lineItems: 2 },
}

const TEMPLATE_WITH_ITEMS = {
  ...TEMPLATE,
  lineItems: [
    { id: 'li-1', templateId: 'tpl-1', category: 'labour', description: 'Erect & dismantle', formula: 'area_m2 * height_m * 0.15', unit: 'hrs' },
  ],
}

describe('GET /api/templates', () => {
  it('returns template list with 200', async () => {
    mockPrisma.template.findMany.mockResolvedValue([TEMPLATE])
    const res = await getTemplates()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([TEMPLATE])
  })
})

describe('POST /api/templates', () => {
  it('creates template and returns 201', async () => {
    mockPrisma.template.create.mockResolvedValue({ ...TEMPLATE, _count: undefined })
    const req = makeReq({ name: 'Standard Independent', scaffoldType: 'independent', accessTypes: ['ground'], loadingClasses: ['light', 'medium'] })
    const res = await postTemplate(req)
    expect(res.status).toBe(201)
  })

  it('returns 400 for missing required fields', async () => {
    const req = makeReq({ name: 'Missing fields' })
    const res = await postTemplate(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new Request('http://localhost', { method: 'POST', body: 'not-json', headers: { 'Content-Type': 'application/json' } })
    const res = await postTemplate(req)
    expect(res.status).toBe(400)
  })
})

describe('GET /api/templates/[templateId]', () => {
  it('returns template with lineItems and 200', async () => {
    mockPrisma.template.findUnique.mockResolvedValue(TEMPLATE_WITH_ITEMS)
    const res = await getTemplate(new Request('http://localhost'), tplParams())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.lineItems).toHaveLength(1)
  })

  it('returns 404 for unknown template', async () => {
    mockPrisma.template.findUnique.mockResolvedValue(null)
    const res = await getTemplate(new Request('http://localhost'), tplParams('unknown'))
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/templates/[templateId]', () => {
  it('updates template name and returns 200', async () => {
    mockPrisma.template.update.mockResolvedValue({ ...TEMPLATE, name: 'Updated' })
    const req = makeReq({ name: 'Updated' })
    const res = await patchTemplate(req, tplParams())
    expect(res.status).toBe(200)
  })

  it('returns 404 for unknown template (P2025)', async () => {
    const { Prisma } = await import('@prisma/client')
    mockPrisma.template.update.mockRejectedValue(
      Object.assign(new Prisma.PrismaClientKnownRequestError('', { code: 'P2025', clientVersion: '' }), {})
    )
    const req = makeReq({ name: 'x' })
    const res = await patchTemplate(req, tplParams('unknown'))
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/templates/[templateId]', () => {
  it('deletes and returns 204', async () => {
    mockPrisma.template.delete.mockResolvedValue({})
    const res = await deleteTemplate(new Request('http://localhost'), tplParams())
    expect(res.status).toBe(204)
  })

  it('returns 404 for unknown template (P2025)', async () => {
    const { Prisma } = await import('@prisma/client')
    mockPrisma.template.delete.mockRejectedValue(
      Object.assign(new Prisma.PrismaClientKnownRequestError('', { code: 'P2025', clientVersion: '' }), {})
    )
    const res = await deleteTemplate(new Request('http://localhost'), tplParams('unknown'))
    expect(res.status).toBe(404)
  })
})

describe('POST /api/templates/[templateId]/line-items', () => {
  it('creates line item and returns 201', async () => {
    mockPrisma.template.findUnique.mockResolvedValue({ id: 'tpl-1' })
    mockPrisma.templateLineItem.create.mockResolvedValue({ id: 'li-2', templateId: 'tpl-1', category: 'labour', description: 'Test', formula: 'area_m2 * 0.1', unit: 'hrs' })
    const req = makeReq({ category: 'labour', description: 'Test', formula: 'area_m2 * 0.1', unit: 'hrs' })
    const res = await postLineItem(req, tplParams())
    expect(res.status).toBe(201)
  })

  it('returns 404 when template not found', async () => {
    mockPrisma.template.findUnique.mockResolvedValue(null)
    const req = makeReq({ category: 'labour', description: 'Test', formula: 'area_m2 * 0.1', unit: 'hrs' })
    const res = await postLineItem(req, tplParams('unknown'))
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/templates/[templateId]/line-items/[lineItemId]', () => {
  it('updates line item and returns 200', async () => {
    mockPrisma.templateLineItem.update.mockResolvedValue({ id: 'li-1', formula: 'area_m2 * 0.2' })
    const req = makeReq({ formula: 'area_m2 * 0.2' })
    const res = await patchLineItem(req, liParams())
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/templates/[templateId]/line-items/[lineItemId]', () => {
  it('deletes and returns 204', async () => {
    mockPrisma.templateLineItem.delete.mockResolvedValue({})
    const res = await deleteLineItem(new Request('http://localhost'), liParams())
    expect(res.status).toBe(204)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/app/api/templates/__tests__/route.test.ts 2>&1 | tail -10
```
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement `src/app/api/templates/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

const TemplateCreateSchema = z.object({
  name: z.string().min(1),
  scaffoldType: z.enum(['independent', 'birdcage', 'putlog', 'suspended', 'cantilever']),
  accessTypes: z.array(z.enum(['ground', 'elevated', 'confined', 'overhead'])).min(1),
  loadingClasses: z.array(z.enum(['light', 'medium', 'heavy'])).min(1),
})

export async function GET() {
  try {
    const templates = await prisma.template.findMany({
      include: { _count: { select: { lineItems: true } } },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(templates)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = TemplateCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const template = await prisma.template.create({ data: parsed.data })
    return NextResponse.json(template, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Implement `src/app/api/templates/[templateId]/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

type Params = { params: Promise<{ templateId: string }> }

const TemplatePatchSchema = z.object({
  name: z.string().min(1).optional(),
  scaffoldType: z.enum(['independent', 'birdcage', 'putlog', 'suspended', 'cantilever']).optional(),
  accessTypes: z.array(z.enum(['ground', 'elevated', 'confined', 'overhead'])).min(1).optional(),
  loadingClasses: z.array(z.enum(['light', 'medium', 'heavy'])).min(1).optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'At least one field required' })

export async function GET(_req: Request, { params }: Params) {
  try {
    const { templateId } = await params
    const template = await prisma.template.findUnique({
      where: { id: templateId },
      include: { lineItems: { orderBy: { category: 'asc' } } },
    })
    if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(template)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const { templateId } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = TemplatePatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const template = await prisma.template.update({ where: { id: templateId }, data: parsed.data })
    return NextResponse.json(template)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { templateId } = await params
  try {
    await prisma.template.delete({ where: { id: templateId } })
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 5: Implement `src/app/api/templates/[templateId]/line-items/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

type Params = { params: Promise<{ templateId: string }> }

const LineItemCreateSchema = z.object({
  category: z.enum(['material', 'labour']),
  description: z.string().min(1),
  formula: z.string().min(1),
  unit: z.string().min(1),
})

export async function POST(req: Request, { params }: Params) {
  const { templateId } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = LineItemCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const template = await prisma.template.findUnique({ where: { id: templateId }, select: { id: true } })
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    const lineItem = await prisma.templateLineItem.create({ data: { ...parsed.data, templateId } })
    return NextResponse.json(lineItem, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 6: Implement `src/app/api/templates/[templateId]/line-items/[lineItemId]/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

type Params = { params: Promise<{ templateId: string; lineItemId: string }> }

const LineItemPatchSchema = z.object({
  category: z.enum(['material', 'labour']).optional(),
  description: z.string().min(1).optional(),
  formula: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'At least one field required' })

export async function PATCH(req: Request, { params }: Params) {
  const { lineItemId } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = LineItemPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const lineItem = await prisma.templateLineItem.update({ where: { id: lineItemId }, data: parsed.data })
    return NextResponse.json(lineItem)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { lineItemId } = await params
  try {
    await prisma.templateLineItem.delete({ where: { id: lineItemId } })
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npx vitest run src/app/api/templates/__tests__/route.test.ts 2>&1 | tail -10
```
Expected: all tests PASS

- [ ] **Step 8: Run full suite to check for regressions**

```bash
npx vitest run 2>&1 | tail -5
```
Expected: all existing tests still pass

- [ ] **Step 9: Commit**

```bash
git add src/app/api/templates/
git commit -m "feat: add template CRUD API routes"
```

---

### Task 2: Estimation Engine

**Files:**
- Create: `src/lib/estimate-engine.ts`
- Create: `src/lib/__tests__/estimate-engine.test.ts`

**Interfaces:**
- Produces: `evaluateFormula(formula: string, zone: ZoneDimensions): number`
- Produces: `generateEstimateItems(lineItems: TemplateLineItemInput[], zone: ZoneDimensions): EstimateItemInput[]`
- Produces: exported types `ZoneDimensions`, `TemplateLineItemInput`, `EstimateItemInput`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/estimate-engine.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { evaluateFormula, generateEstimateItems } from '../estimate-engine'
import type { ZoneDimensions, TemplateLineItemInput } from '../estimate-engine'

const zone: ZoneDimensions = { heightM: 4, perimeterM: 20, areaM2: 25 }

describe('evaluateFormula', () => {
  it('evaluates area_m2 variable', () => {
    expect(evaluateFormula('area_m2', zone)).toBe(25)
  })

  it('evaluates perimeter_m variable', () => {
    expect(evaluateFormula('perimeter_m', zone)).toBe(20)
  })

  it('evaluates height_m variable', () => {
    expect(evaluateFormula('height_m', zone)).toBe(4)
  })

  it('evaluates combined formula with *', () => {
    expect(evaluateFormula('area_m2 * height_m * 0.15', zone)).toBeCloseTo(15)
  })

  it('evaluates formula with × unicode operator', () => {
    expect(evaluateFormula('area_m2 × height_m × 0.15', zone)).toBeCloseTo(15)
  })

  it('evaluates formula with parentheses', () => {
    expect(evaluateFormula('(perimeter_m + area_m2) * height_m', zone)).toBe(180)
  })

  it('throws on formula with unexpected characters', () => {
    expect(() => evaluateFormula('require("fs")', zone)).toThrow()
  })

  it('throws when result is non-finite', () => {
    expect(() => evaluateFormula('area_m2 / 0', zone)).toThrow()
  })
})

describe('generateEstimateItems', () => {
  const lineItems: TemplateLineItemInput[] = [
    { category: 'labour', description: 'Erect & dismantle', formula: 'area_m2 * height_m * 0.15', unit: 'hrs' },
    { category: 'material', description: 'Tube & coupler', formula: 'perimeter_m * height_m * 1.5', unit: 'm' },
  ]

  it('generates correct quantities', () => {
    const items = generateEstimateItems(lineItems, zone)
    expect(items[0].quantity).toBeCloseTo(15)
    expect(items[1].quantity).toBeCloseTo(120)
  })

  it('sets unitManhours 1.0 for labour, 0 for material', () => {
    const items = generateEstimateItems(lineItems, zone)
    expect(items[0].unitManhours).toBe(1.0)
    expect(items[1].unitManhours).toBe(0)
  })

  it('preserves category, description, unit from template', () => {
    const items = generateEstimateItems(lineItems, zone)
    expect(items[0].category).toBe('labour')
    expect(items[0].description).toBe('Erect & dismantle')
    expect(items[0].unit).toBe('hrs')
  })

  it('rounds quantity to 2 decimal places', () => {
    const items = generateEstimateItems(
      [{ category: 'labour', description: 'x', formula: 'area_m2 * 0.333', unit: 'hrs' }],
      zone,
    )
    const str = String(items[0].quantity)
    const decimals = str.includes('.') ? str.split('.')[1].length : 0
    expect(decimals).toBeLessThanOrEqual(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/__tests__/estimate-engine.test.ts 2>&1 | tail -10
```
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement `src/lib/estimate-engine.ts`**

```ts
export type ZoneDimensions = {
  heightM: number
  perimeterM: number
  areaM2: number
}

export type TemplateLineItemInput = {
  category: 'material' | 'labour'
  description: string
  formula: string
  unit: string
}

export type EstimateItemInput = {
  category: 'material' | 'labour'
  description: string
  quantity: number
  unit: string
  unitManhours: number
}

export function evaluateFormula(formula: string, zone: ZoneDimensions): number {
  const expr = formula
    .replace(/area_m2/g, String(zone.areaM2))
    .replace(/perimeter_m/g, String(zone.perimeterM))
    .replace(/height_m/g, String(zone.heightM))
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
  // Only digits, spaces, basic arithmetic operators, decimal points, parentheses
  if (!/^[\d\s+\-*/.()]+$/.test(expr)) {
    throw new Error(`Invalid formula expression: "${formula}"`)
  }
  // eslint-disable-next-line no-new-func
  const result = Function(`"use strict"; return (${expr})`)() as number
  if (!Number.isFinite(result)) {
    throw new Error(`Formula produced non-finite result: "${formula}"`)
  }
  return result
}

export function generateEstimateItems(
  lineItems: TemplateLineItemInput[],
  zone: ZoneDimensions,
): EstimateItemInput[] {
  return lineItems.map((li) => {
    const raw = evaluateFormula(li.formula, zone)
    const quantity = Math.round(Math.max(0, raw) * 100) / 100
    return {
      category: li.category,
      description: li.description,
      quantity,
      unit: li.unit,
      unitManhours: li.category === 'labour' ? 1.0 : 0,
    }
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/estimate-engine.test.ts 2>&1 | tail -10
```
Expected: 12 tests PASS

- [ ] **Step 5: Run full suite**

```bash
npx vitest run 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/estimate-engine.ts src/lib/__tests__/estimate-engine.test.ts
git commit -m "feat: add estimation engine with formula evaluator"
```

---

### Task 3: Generate Estimate API + Zone Panel Wiring

**Files:**
- Create: `src/app/api/jobs/[jobId]/drawings/[drawingId]/zones/[zoneId]/estimate/route.ts`
- Create: `src/app/api/jobs/[jobId]/drawings/[drawingId]/zones/[zoneId]/estimate/__tests__/route.test.ts`
- Modify: `src/components/drawing-editor/zone-panel.tsx`
- Modify: `src/components/drawing-editor/drawing-editor.tsx`

**Interfaces:**
- Consumes: `generateEstimateItems` from `@/lib/estimate-engine`
- Consumes: `ZonePanel` props — will add `templates` and `onGenerateEstimate` props
- Produces: `POST /api/jobs/.../zones/[zoneId]/estimate` → `EstimateItem[]` with 200; 404 if zone missing; 422 if no matching template

- [ ] **Step 1: Write the failing test**

Create `src/app/api/jobs/[jobId]/drawings/[drawingId]/zones/[zoneId]/estimate/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = {
  zone: { findUnique: vi.fn(), update: vi.fn() },
  template: { findUnique: vi.fn(), findFirst: vi.fn() },
  estimateItem: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/estimate-engine', () => ({
  generateEstimateItems: vi.fn(() => [
    { category: 'labour', description: 'Erect', quantity: 15, unit: 'hrs', unitManhours: 1.0 },
  ]),
}))

import { POST } from '../route'

type Params = { params: Promise<{ jobId: string; drawingId: string; zoneId: string }> }
const makeParams = (zoneId = 'z1'): Params => ({
  params: Promise.resolve({ jobId: 'j1', drawingId: 'd1', zoneId }),
})
const makeReq = (body?: unknown) =>
  new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : '{}',
  })

const ZONE = {
  id: 'z1',
  scaffoldType: 'independent',
  accessType: 'ground',
  loadingClass: 'light',
  heightM: 4,
  perimeterM: 20,
  areaM2: 25,
  estimateItems: [],
}

const TEMPLATE = {
  id: 'tpl-1',
  name: 'Standard Independent',
  scaffoldType: 'independent',
  lineItems: [{ id: 'li-1', category: 'labour', description: 'Erect', formula: 'area_m2 * height_m * 0.15', unit: 'hrs' }],
}

const GENERATED_ITEMS = [{ id: 'ei-1', zoneId: 'z1', category: 'labour', description: 'Erect', quantity: 15, unit: 'hrs', unitManhours: 1.0, overridden: false }]

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.estimateItem.deleteMany.mockResolvedValue({ count: 0 })
  mockPrisma.estimateItem.createMany.mockResolvedValue({ count: 1 })
  mockPrisma.estimateItem.findMany.mockResolvedValue(GENERATED_ITEMS)
  mockPrisma.zone.update.mockResolvedValue({})
})

describe('POST /zones/[zoneId]/estimate', () => {
  it('auto-matches template and returns generated items with 200', async () => {
    mockPrisma.zone.findUnique.mockResolvedValue(ZONE)
    mockPrisma.template.findFirst.mockResolvedValue(TEMPLATE)
    const res = await POST(makeReq(), makeParams())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(GENERATED_ITEMS)
  })

  it('uses provided templateId and returns 200', async () => {
    mockPrisma.zone.findUnique.mockResolvedValue(ZONE)
    mockPrisma.template.findUnique.mockResolvedValue(TEMPLATE)
    const res = await POST(makeReq({ templateId: 'tpl-1' }), makeParams())
    expect(res.status).toBe(200)
    expect(mockPrisma.template.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'tpl-1' } }))
  })

  it('returns 422 when no matching template found', async () => {
    mockPrisma.zone.findUnique.mockResolvedValue(ZONE)
    mockPrisma.template.findFirst.mockResolvedValue(null)
    const res = await POST(makeReq(), makeParams())
    expect(res.status).toBe(422)
  })

  it('returns 404 for unknown zone', async () => {
    mockPrisma.zone.findUnique.mockResolvedValue(null)
    const res = await POST(makeReq(), makeParams('unknown'))
    expect(res.status).toBe(404)
  })

  it('preserves overridden existing items', async () => {
    const overriddenItem = { id: 'ei-0', zoneId: 'z1', category: 'labour', description: 'Erect', quantity: 99, unit: 'hrs', unitManhours: 1.5, overridden: true }
    mockPrisma.zone.findUnique.mockResolvedValue({ ...ZONE, estimateItems: [overriddenItem] })
    mockPrisma.template.findFirst.mockResolvedValue(TEMPLATE)
    await POST(makeReq(), makeParams())
    // Should only delete non-overridden items
    expect(mockPrisma.estimateItem.deleteMany).toHaveBeenCalledWith({ where: { zoneId: 'z1', overridden: false } })
    // Should not re-create item with same key as overridden one
    const createCall = mockPrisma.estimateItem.createMany.mock.calls[0][0]
    const descriptions = createCall.data.map((d: { description: string }) => d.description)
    expect(descriptions).not.toContain('Erect')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/app/api/jobs/[jobId]/drawings/[drawingId]/zones/[zoneId]/estimate/__tests__/route.test.ts 2>&1 | tail -10
```
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement `src/app/api/jobs/[jobId]/drawings/[drawingId]/zones/[zoneId]/estimate/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { generateEstimateItems } from '@/lib/estimate-engine'

type Params = { params: Promise<{ jobId: string; drawingId: string; zoneId: string }> }

const GenerateSchema = z.object({
  templateId: z.string().optional(),
})

export async function POST(req: Request, { params }: Params) {
  const { zoneId } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = GenerateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const zone = await prisma.zone.findUnique({
      where: { id: zoneId },
      include: { estimateItems: true },
    })
    if (!zone) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let template = null
    if (parsed.data.templateId) {
      template = await prisma.template.findUnique({
        where: { id: parsed.data.templateId },
        include: { lineItems: true },
      })
      if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    } else {
      template = await prisma.template.findFirst({
        where: {
          scaffoldType: zone.scaffoldType,
          accessTypes: { has: zone.accessType },
          loadingClasses: { has: zone.loadingClass },
        },
        include: { lineItems: true },
      })
    }
    if (!template) {
      return NextResponse.json({ error: 'No matching template found' }, { status: 422 })
    }

    const newItems = generateEstimateItems(
      template.lineItems.map((li) => ({
        category: li.category as 'material' | 'labour',
        description: li.description,
        formula: li.formula,
        unit: li.unit,
      })),
      { heightM: zone.heightM, perimeterM: zone.perimeterM, areaM2: zone.areaM2 },
    )

    // Keys of existing overridden items — we skip re-generating these
    const overriddenKeys = new Set(
      zone.estimateItems
        .filter((i) => i.overridden)
        .map((i) => `${i.category}:${i.description}`),
    )

    await prisma.estimateItem.deleteMany({ where: { zoneId, overridden: false } })

    const toCreate = newItems.filter(
      (i) => !overriddenKeys.has(`${i.category}:${i.description}`),
    )
    if (toCreate.length > 0) {
      await prisma.estimateItem.createMany({
        data: toCreate.map((i) => ({ ...i, zoneId })),
      })
    }

    await prisma.zone.update({ where: { id: zoneId }, data: { templateId: template.id } })

    const allItems = await prisma.estimateItem.findMany({
      where: { zoneId },
      orderBy: [{ category: 'asc' }, { description: 'asc' }],
    })
    return NextResponse.json(allItems)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/app/api/jobs/[jobId]/drawings/[drawingId]/zones/[zoneId]/estimate/__tests__/route.test.ts 2>&1 | tail -10
```
Expected: 5 tests PASS

- [ ] **Step 5: Modify `src/components/drawing-editor/zone-panel.tsx`**

Add `templates` and `onGenerateEstimate` props. Add a template selector `<select>` and a "Generate Estimate" button visible only in edit mode.

The full updated file:

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
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

export type TemplateSummary = {
  id: string
  name: string
  scaffoldType: string
}

type Props = {
  mode: 'new' | 'edit'
  initialValues?: Partial<ZoneFormValues>
  templates?: TemplateSummary[]
  onSave: (values: ZoneFormValues) => Promise<void>
  onDelete?: () => Promise<void>
  onGenerateEstimate?: (templateId: string | undefined) => Promise<void>
  onClose: () => void
}

const FIELD_CLASS =
  'w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]'
const LABEL_CLASS = 'block text-xs font-medium text-muted-foreground mb-1'

export default function ZonePanel({
  mode,
  initialValues,
  templates = [],
  onSave,
  onDelete,
  onGenerateEstimate,
  onClose,
}: Props): React.JSX.Element {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<ZoneFormValues>({
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

  const [isGenerating, setIsGenerating] = useState(false)
  const [generateStatus, setGenerateStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const accessType = watch('accessType')
  const loadingClass = watch('loadingClass')
  const templateId = watch('templateId')

  // Auto-suggest scaffold type when access type or loading class changes.
  // Skip the initial render so we don't overwrite the stored value in edit mode.
  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return }
    setValue('scaffoldType', suggestScaffoldType(accessType, loadingClass), { shouldDirty: true })
  }, [accessType, loadingClass, setValue])

  async function handleDelete() {
    if (!onDelete) return
    await onDelete()
  }

  async function handleGenerateEstimate() {
    if (!onGenerateEstimate) return
    setIsGenerating(true)
    setGenerateStatus('idle')
    try {
      await onGenerateEstimate(templateId ?? undefined)
      setGenerateStatus('success')
      setTimeout(() => setGenerateStatus('idle'), 2000)
    } catch {
      setGenerateStatus('error')
      setTimeout(() => setGenerateStatus('idle'), 3000)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <aside
      className="w-72 flex-shrink-0 flex flex-col border-l border-[var(--border)] bg-[var(--card)] overflow-y-auto"
      style={{ minHeight: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold">
          {mode === 'new' ? 'New Zone' : 'Edit Zone'}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-lg leading-none"
          aria-label="Close panel"
        >
          ×
        </button>
      </div>

      {/* Form body */}
      <form onSubmit={handleSubmit(onSave)} className="flex flex-col gap-4 p-4 flex-1">
        {/* Label */}
        <div>
          <label htmlFor="zone-label" className={LABEL_CLASS}>Label *</label>
          <input
            id="zone-label"
            {...register('label', { required: true })}
            className={FIELD_CLASS}
            placeholder="e.g. Zone A"
          />
          {errors.label && (
            <p className="text-xs mt-1" style={{ color: 'var(--destructive)' }}>
              Required
            </p>
          )}
        </div>

        {/* Access Type */}
        <div>
          <label htmlFor="zone-accessType" className={LABEL_CLASS}>Access Type</label>
          <select id="zone-accessType" {...register('accessType')} className={FIELD_CLASS}>
            <option value="ground">Ground</option>
            <option value="elevated">Elevated</option>
            <option value="confined">Confined</option>
            <option value="overhead">Overhead</option>
          </select>
        </div>

        {/* Loading Class */}
        <div>
          <label htmlFor="zone-loadingClass" className={LABEL_CLASS}>Loading Class</label>
          <select id="zone-loadingClass" {...register('loadingClass')} className={FIELD_CLASS}>
            <option value="light">Light</option>
            <option value="medium">Medium</option>
            <option value="heavy">Heavy</option>
          </select>
        </div>

        {/* Measurements — 3-col grid */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label htmlFor="zone-heightM" className={LABEL_CLASS}>Height (m)</label>
            <input
              id="zone-heightM"
              type="number"
              step="0.1"
              min="0"
              {...register('heightM', { valueAsNumber: true })}
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label htmlFor="zone-perimeterM" className={LABEL_CLASS}>Perimeter (m)</label>
            <input
              id="zone-perimeterM"
              type="number"
              step="0.1"
              min="0"
              {...register('perimeterM', { valueAsNumber: true })}
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label htmlFor="zone-areaM2" className={LABEL_CLASS}>Area (m²)</label>
            <input
              id="zone-areaM2"
              type="number"
              step="0.1"
              min="0"
              {...register('areaM2', { valueAsNumber: true })}
              className={FIELD_CLASS}
            />
          </div>
        </div>

        {/* Scaffold Type */}
        <div>
          <label htmlFor="zone-scaffoldType" className={LABEL_CLASS}>
            Scaffold Type{' '}
            <span className="font-normal text-muted-foreground">(auto-suggested)</span>
          </label>
          <select id="zone-scaffoldType" {...register('scaffoldType')} className={FIELD_CLASS}>
            <option value="independent">Independent</option>
            <option value="birdcage">Birdcage</option>
            <option value="putlog">Putlog</option>
            <option value="suspended">Suspended</option>
            <option value="cantilever">Cantilever</option>
          </select>
        </div>

        {/* Template selector (optional) */}
        {templates.length > 0 && (
          <div>
            <label htmlFor="zone-templateId" className={LABEL_CLASS}>
              Template <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <select
              id="zone-templateId"
              {...register('templateId')}
              className={FIELD_CLASS}
            >
              <option value="">Auto-match</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Footer: Save + optional Delete */}
        <div className="flex gap-2 mt-auto pt-2">
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? 'Saving…' : 'Save Zone'}
          </Button>
          {mode === 'edit' && onDelete !== undefined && (
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

        {/* Generate Estimate — only in edit mode */}
        {mode === 'edit' && onGenerateEstimate && (
          <div className="pt-1 border-t border-[var(--border)]">
            <Button
              type="button"
              onClick={handleGenerateEstimate}
              disabled={isGenerating}
              className="w-full"
              style={{ background: 'var(--green)', color: '#fff' }}
            >
              {isGenerating
                ? 'Generating…'
                : generateStatus === 'success'
                ? '✓ Estimate Generated'
                : generateStatus === 'error'
                ? '✗ Generation Failed'
                : 'Generate Estimate'}
            </Button>
          </div>
        )}
      </form>
    </aside>
  )
}
```

- [ ] **Step 6: Modify `src/components/drawing-editor/drawing-editor.tsx`**

Add template fetching and `handleGenerateEstimate`. Add a "View Estimate" link in the header.

Replace the imports block and the component with this updated version (preserve all existing logic; only add the new parts):

```tsx
'use client'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import ZonePanel, { ZoneFormValues, TemplateSummary } from './zone-panel'
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
  const [templates, setTemplates] = useState<TemplateSummary[]>([])

  useEffect(() => {
    fetch('/api/templates')
      .then((r) => r.json())
      .then((data: TemplateSummary[]) => setTemplates(data))
      .catch(() => {})
  }, [])

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
      const res = await fetch(`/api/jobs/${drawing.jobId}/drawings/${drawing.id}/zones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageNumber: currentPage, canvasData: draftRect, ...values }),
      })
      if (!res.ok) throw new Error('Failed to save zone')
      const newZone: Zone = await res.json()
      setZones((prev) => [...prev, newZone])
      setDraftRect(null)
      setSelectedZoneId(newZone.id)
    } else if (selectedZone) {
      const res = await fetch(
        `/api/jobs/${drawing.jobId}/drawings/${drawing.id}/zones/${selectedZone.id}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) },
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

  async function handleGenerateEstimate(templateId: string | undefined) {
    if (!selectedZone) return
    const res = await fetch(
      `/api/jobs/${drawing.jobId}/drawings/${drawing.id}/zones/${selectedZone.id}/estimate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateId ? { templateId } : {}),
      },
    )
    if (!res.ok) throw new Error('Failed to generate estimate')
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
      <div className="flex items-center justify-between px-4 py-2 border-b border-border flex-shrink-0 bg-card">
        <div>
          <span className="text-sm font-medium">{drawing.filename}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            {drawing.structureName} ({drawing.structureId})
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            render={<Link href={`/jobs/${drawing.jobId}/estimate`} />}
            style={{ fontSize: 12, padding: '2px 10px', background: 'var(--green)', color: '#fff' }}
          >
            View Estimate
          </Button>
          <span className="text-xs text-muted-foreground">
            {pageZones.length} zone{pageZones.length !== 1 ? 's' : ''} on page
          </span>
          {/* Page navigation */}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              aria-label="Previous page"
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
              aria-label="Next page"
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
            templates={templates}
            onSave={handleSave}
            onDelete={panelMode === 'edit' ? handleDelete : undefined}
            onGenerateEstimate={panelMode === 'edit' ? handleGenerateEstimate : undefined}
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

- [ ] **Step 7: Run full test suite**

```bash
npx vitest run 2>&1 | tail -5
```
Expected: all tests pass (no regressions from the component edits — they have no tests of their own)

- [ ] **Step 8: Commit**

```bash
git add src/app/api/jobs/[jobId]/drawings/[drawingId]/zones/[zoneId]/estimate/ \
        src/components/drawing-editor/zone-panel.tsx \
        src/components/drawing-editor/drawing-editor.tsx
git commit -m "feat: generate estimate API, template selector, and zone panel wiring"
```

---

### Task 4: Estimate Sheet (Override API + Editable Page)

**Files:**
- Create: `src/app/api/jobs/[jobId]/drawings/[drawingId]/zones/[zoneId]/estimate-items/[itemId]/route.ts`
- Create: `src/app/api/jobs/[jobId]/drawings/[drawingId]/zones/[zoneId]/estimate-items/__tests__/route.test.ts`
- Create: `src/components/estimate/estimate-sheet.tsx`
- Create: `src/app/jobs/[jobId]/estimate/page.tsx`
- Modify: `src/app/jobs/[jobId]/page.tsx`

**Interfaces:**
- Produces: `PATCH /estimate-items/[itemId]` → updated `EstimateItem` with `overridden: true`; 400 if no fields; 404 if not found
- Produces: `/jobs/[jobId]/estimate` — Estimate Sheet page grouped by structure → zone → items

- [ ] **Step 1: Write the failing tests for the override endpoint**

Create `src/app/api/jobs/[jobId]/drawings/[drawingId]/zones/[zoneId]/estimate-items/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = {
  estimateItem: {
    update: vi.fn(),
  },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

import { PATCH } from '../[itemId]/route'

type Params = { params: Promise<{ jobId: string; drawingId: string; zoneId: string; itemId: string }> }
const makeParams = (itemId = 'ei-1'): Params => ({
  params: Promise.resolve({ jobId: 'j1', drawingId: 'd1', zoneId: 'z1', itemId }),
})
const makeReq = (body: unknown) =>
  new Request('http://localhost', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

beforeEach(() => vi.clearAllMocks())

describe('PATCH /estimate-items/[itemId]', () => {
  it('overrides quantity and sets overridden=true', async () => {
    mockPrisma.estimateItem.update.mockResolvedValue({
      id: 'ei-1', quantity: 20, unitManhours: 1.0, overridden: true,
    })
    const res = await PATCH(makeReq({ quantity: 20 }), makeParams())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.overridden).toBe(true)
    expect(mockPrisma.estimateItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ quantity: 20, overridden: true }) })
    )
  })

  it('overrides unitManhours and sets overridden=true', async () => {
    mockPrisma.estimateItem.update.mockResolvedValue({
      id: 'ei-1', quantity: 15, unitManhours: 1.5, overridden: true,
    })
    const res = await PATCH(makeReq({ unitManhours: 1.5 }), makeParams())
    expect(res.status).toBe(200)
    expect(mockPrisma.estimateItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ unitManhours: 1.5, overridden: true }) })
    )
  })

  it('returns 400 when no fields provided', async () => {
    const res = await PATCH(makeReq({}), makeParams())
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new Request('http://localhost', { method: 'PATCH', body: 'bad', headers: { 'Content-Type': 'application/json' } })
    const res = await PATCH(req, makeParams())
    expect(res.status).toBe(400)
  })

  it('returns 404 for unknown item (P2025)', async () => {
    const { Prisma } = await import('@prisma/client')
    mockPrisma.estimateItem.update.mockRejectedValue(
      Object.assign(new Prisma.PrismaClientKnownRequestError('', { code: 'P2025', clientVersion: '' }), {})
    )
    const res = await PATCH(makeReq({ quantity: 5 }), makeParams('unknown'))
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/app/api/jobs/[jobId]/drawings/[drawingId]/zones/[zoneId]/estimate-items/__tests__/route.test.ts 2>&1 | tail -10
```
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement the override PATCH route**

Create `src/app/api/jobs/[jobId]/drawings/[drawingId]/zones/[zoneId]/estimate-items/[itemId]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

type Params = { params: Promise<{ jobId: string; drawingId: string; zoneId: string; itemId: string }> }

const EstimateItemPatchSchema = z
  .object({
    quantity: z.number().min(0).optional(),
    unitManhours: z.number().min(0).optional(),
  })
  .refine((d) => d.quantity !== undefined || d.unitManhours !== undefined, {
    message: 'At least one of quantity or unitManhours must be provided',
  })

export async function PATCH(req: Request, { params }: Params) {
  const { itemId } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = EstimateItemPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const item = await prisma.estimateItem.update({
      where: { id: itemId },
      data: { ...parsed.data, overridden: true },
    })
    return NextResponse.json(item)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/app/api/jobs/[jobId]/drawings/[drawingId]/zones/[zoneId]/estimate-items/__tests__/route.test.ts 2>&1 | tail -10
```
Expected: 5 tests PASS

- [ ] **Step 5: Create `src/components/estimate/estimate-sheet.tsx`**

This client component receives the job's estimate data and handles inline editing. It calls the override PATCH endpoint on input blur and highlights overridden cells in amber.

```tsx
'use client'
import { useState } from 'react'

type EstimateItem = {
  id: string
  category: 'material' | 'labour'
  description: string
  quantity: number
  unit: string
  unitManhours: number
  overridden: boolean
  zoneId: string
  drawingId: string
  jobId: string
}

type ZoneEstimate = {
  id: string
  label: string
  scaffoldType: string
  items: EstimateItem[]
}

type StructureEstimate = {
  structureId: string
  structureName: string
  drawingId: string
  zones: ZoneEstimate[]
}

type Props = {
  jobId: string
  title: string
  structures: StructureEstimate[]
}

const OVERRIDE_BG = 'bg-amber-50'

export default function EstimateSheet({ jobId, title, structures }: Props): React.JSX.Element {
  const [items, setItems] = useState<Map<string, EstimateItem>>(() => {
    const map = new Map<string, EstimateItem>()
    for (const s of structures) {
      for (const z of s.zones) {
        for (const item of z.items) {
          map.set(item.id, { ...item, jobId, drawingId: s.drawingId, zoneId: z.id })
        }
      }
    }
    return map
  })

  async function handleBlur(itemId: string, field: 'quantity' | 'unitManhours', value: string) {
    const parsed = parseFloat(value)
    if (isNaN(parsed) || parsed < 0) return
    const item = items.get(itemId)
    if (!item || item[field] === parsed) return

    try {
      const res = await fetch(
        `/api/jobs/${item.jobId}/drawings/${item.drawingId}/zones/${item.zoneId}/estimate-items/${itemId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: parsed }),
        },
      )
      if (!res.ok) return
      const updated: EstimateItem = await res.json()
      setItems((prev) => {
        const next = new Map(prev)
        next.set(itemId, { ...item, ...updated })
        return next
      })
    } catch {
      // silently ignore — the user sees no change
    }
  }

  function totalManhours(zoneItems: EstimateItem[]): number {
    return zoneItems
      .filter((i) => i.category === 'labour')
      .reduce((sum, i) => {
        const item = items.get(i.id) ?? i
        return sum + item.quantity * item.unitManhours
      }, 0)
  }

  const CELL = 'px-3 py-2 text-sm'
  const HEADER_CELL = 'px-3 py-2 text-xs font-medium text-muted-foreground text-left'
  const INPUT_CLASS =
    'w-full bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-[var(--ring)] rounded text-sm text-right'

  return (
    <div className="p-6 space-y-8 overflow-auto h-full" style={{ background: 'var(--background)' }}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Estimate — {title}</h1>
      </div>

      {structures.length === 0 && (
        <p className="text-muted-foreground text-sm">No estimate items yet. Generate estimates from the Drawing Editor.</p>
      )}

      {structures.map((structure) => {
        const structureManhours = structure.zones.flatMap((z) => z.items).reduce((sum, i) => {
          const item = items.get(i.id) ?? i
          return i.category === 'labour' ? sum + item.quantity * item.unitManhours : sum
        }, 0)

        return (
          <div key={structure.structureId} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--navy)' }}>
                {structure.structureName}{' '}
                <span className="text-sm font-normal text-muted-foreground">({structure.structureId})</span>
              </h2>
              <span className="text-sm font-medium">
                {structureManhours.toFixed(1)} total manhours
              </span>
            </div>

            {structure.zones.map((zone) => {
              const zoneItems = zone.items.map((i) => items.get(i.id) ?? i)
              const labourItems = zoneItems.filter((i) => i.category === 'labour')
              const materialItems = zoneItems.filter((i) => i.category === 'material')
              const zoneManhours = totalManhours(zone.items)

              return (
                <div key={zone.id} className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
                    <span className="text-sm font-medium">{zone.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {zone.scaffoldType} · {zoneManhours.toFixed(1)} hrs
                    </span>
                  </div>

                  {zoneItems.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted-foreground">No estimate items. Click Generate Estimate in the Drawing Editor.</p>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className={HEADER_CELL} style={{ width: '40%' }}>Description</th>
                          <th className={`${HEADER_CELL} text-right`}>Qty</th>
                          <th className={HEADER_CELL}>Unit</th>
                          <th className={`${HEADER_CELL} text-right`}>Manhours/unit</th>
                          <th className={`${HEADER_CELL} text-right`}>Total hrs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {labourItems.length > 0 && (
                          <tr>
                            <td colSpan={5} className="px-3 py-1 text-xs font-medium text-muted-foreground bg-muted/30">
                              Labour
                            </td>
                          </tr>
                        )}
                        {labourItems.map((item) => (
                          <tr
                            key={item.id}
                            className={`border-t border-border/50 ${item.overridden ? OVERRIDE_BG : ''}`}
                          >
                            <td className={CELL}>{item.description}</td>
                            <td className={`${CELL} text-right`}>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                defaultValue={item.quantity}
                                onBlur={(e) => handleBlur(item.id, 'quantity', e.target.value)}
                                className={INPUT_CLASS}
                                aria-label={`Quantity for ${item.description}`}
                              />
                            </td>
                            <td className={CELL}>{item.unit}</td>
                            <td className={`${CELL} text-right`}>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                defaultValue={item.unitManhours}
                                onBlur={(e) => handleBlur(item.id, 'unitManhours', e.target.value)}
                                className={INPUT_CLASS}
                                aria-label={`Manhours per unit for ${item.description}`}
                              />
                            </td>
                            <td className={`${CELL} text-right font-medium`}>
                              {(item.quantity * item.unitManhours).toFixed(2)}
                            </td>
                          </tr>
                        ))}

                        {materialItems.length > 0 && (
                          <tr>
                            <td colSpan={5} className="px-3 py-1 text-xs font-medium text-muted-foreground bg-muted/30">
                              Materials
                            </td>
                          </tr>
                        )}
                        {materialItems.map((item) => (
                          <tr
                            key={item.id}
                            className={`border-t border-border/50 ${item.overridden ? OVERRIDE_BG : ''}`}
                          >
                            <td className={CELL}>{item.description}</td>
                            <td className={`${CELL} text-right`}>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                defaultValue={item.quantity}
                                onBlur={(e) => handleBlur(item.id, 'quantity', e.target.value)}
                                className={INPUT_CLASS}
                                aria-label={`Quantity for ${item.description}`}
                              />
                            </td>
                            <td className={CELL}>{item.unit}</td>
                            <td className={`${CELL} text-right text-muted-foreground`}>—</td>
                            <td className={`${CELL} text-right text-muted-foreground`}>—</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 6: Create `src/app/jobs/[jobId]/estimate/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import EstimateSheet from '@/components/estimate/estimate-sheet'

type Params = { params: Promise<{ jobId: string }> }

export default async function EstimatePage({ params }: Params) {
  const { jobId } = await params
  let job
  try {
    job = await prisma.job.findUnique({
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
  } catch {
    job = null
  }
  if (!job) notFound()

  const structures = job.drawings.map((drawing) => ({
    structureId: drawing.structureId,
    structureName: drawing.structureName,
    drawingId: drawing.id,
    zones: drawing.zones.map((zone) => ({
      id: zone.id,
      label: zone.label,
      scaffoldType: zone.scaffoldType,
      items: zone.estimateItems.map((item) => ({
        id: item.id,
        category: item.category as 'material' | 'labour',
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitManhours: item.unitManhours,
        overridden: item.overridden,
        zoneId: zone.id,
        drawingId: drawing.id,
        jobId,
      })),
    })),
  }))

  return (
    <EstimateSheet
      jobId={jobId}
      title={`${job.projectNumber} — ${job.title}`}
      structures={structures}
    />
  )
}
```

- [ ] **Step 7: Modify `src/app/jobs/[jobId]/page.tsx` to add "View Estimate" link**

Replace the file with this updated version (adds a `Link` import, a `Button` import, and a "View Estimate" button in the header next to the status badge):

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { DrawingList } from '@/components/drawings/drawing-list'
import { UploadDrawingForm } from '@/components/drawings/upload-drawing-form'
import { JobStatusBadge } from '@/components/jobs/job-status-badge'

type Params = { params: Promise<{ jobId: string }> }

export default async function JobDetailPage({ params }: Params) {
  const { jobId } = await params
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { drawings: { orderBy: { structureId: 'asc' } } },
  })
  if (!job) notFound()

  return (
    <div className="p-6 overflow-auto h-full space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-mono">{job.projectNumber}</p>
          <h1 className="text-2xl font-semibold">{job.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {job.client} · {job.durationWeeks} weeks · starts {new Date(job.startDate).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button render={<Link href={`/jobs/${job.id}/estimate`} />}>
            View Estimate
          </Button>
          <JobStatusBadge status={job.status} />
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Drawings</h2>
        <DrawingList drawings={job.drawings} jobId={job.id} />
        <div className="border-t pt-4">
          <h3 className="text-sm font-medium mb-3">Upload Drawing</h3>
          <UploadDrawingForm jobId={job.id} />
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 8: Run full test suite**

```bash
npx vitest run 2>&1 | tail -5
```
Expected: all tests pass

- [ ] **Step 9: Commit**

```bash
git add src/app/api/jobs/[jobId]/drawings/[drawingId]/zones/[zoneId]/estimate-items/ \
        src/components/estimate/ \
        src/app/jobs/[jobId]/estimate/ \
        src/app/jobs/[jobId]/page.tsx
git commit -m "feat: estimate sheet with override API, editable items, and rollup totals"
```
