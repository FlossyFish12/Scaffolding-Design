# Scaffolding Platform — Plan 1: Foundation & Job Management

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the Next.js application, set up the full database schema, and deliver a working job management UI — create jobs, upload PDF drawings, and view job detail.

**Architecture:** Next.js 16 App Router with Prisma ORM + PostgreSQL (Neon via Vercel Marketplace) + Vercel Blob for PDF storage. Pages are React Server Components by default; interactive forms are `'use client'` components that POST to API routes.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS, shadcn/ui, Prisma, Neon PostgreSQL, Vercel Blob, Zod, Vitest, @testing-library/react

## Global Constraints

- Node.js 24 LTS
- Next.js 16 App Router only — no Pages Router
- TypeScript strict mode throughout
- All API routes return `NextResponse.json()`
- Database: Neon PostgreSQL via Vercel Marketplace — `DATABASE_URL` env var
- File storage: Vercel Blob — `BLOB_READ_WRITE_TOKEN` env var
- shadcn/ui for all UI components — no additional component libraries
- Zod for all input validation at API boundaries
- Prisma for all database access — no raw SQL
- Tests use Vitest + @testing-library/react + jsdom
- `src/` directory layout with `@/` alias

## File Map

```
src/
  app/
    layout.tsx                          # Root layout with nav
    page.tsx                            # Redirect to /jobs
    jobs/
      page.tsx                          # Job Dashboard
      new/
        page.tsx                        # New Job page
      [jobId]/
        page.tsx                        # Job Detail
    api/
      jobs/
        route.ts                        # GET list, POST create
        [jobId]/
          route.ts                      # GET, PATCH, DELETE
          drawings/
            route.ts                    # GET list, POST upload
            [drawingId]/
              route.ts                  # GET, DELETE
  lib/
    db.ts                               # Prisma singleton
  types/
    index.ts                            # Re-exports from @prisma/client
  components/
    nav.tsx                             # Top nav bar
    jobs/
      job-list.tsx                      # Table of jobs
      job-list.test.tsx
      job-status-badge.tsx              # Badge for draft/estimated/approved
      create-job-form.tsx               # New job form
      create-job-form.test.tsx
    drawings/
      drawing-list.tsx                  # Drawings grouped by structure
      drawing-list.test.tsx
      upload-drawing-form.tsx           # Upload PDF form
  test/
    setup.ts                            # @testing-library/jest-dom import
prisma/
  schema.prisma
```

---

### Task 1: Bootstrap Project

**Files:**
- Create: `package.json` (via create-next-app)
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Produces: Running Next.js dev server at localhost:3000, Vitest test runner

- [ ] **Step 1: Scaffold the project**

```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --yes
```

Expected: project files created, `npm run dev` starts at localhost:3000.

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install @prisma/client zod @vercel/blob
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D prisma vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 4: Initialise Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

Expected: `prisma/schema.prisma` and `.env` created.

- [ ] **Step 5: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
})
```

- [ ] **Step 6: Create test setup**

Create `src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 7: Add test scripts to package.json**

In `package.json` `"scripts"`, add:

```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 8: Replace root page with redirect**

Replace `src/app/page.tsx`:

```typescript
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/jobs')
}
```

- [ ] **Step 9: Verify dev server starts**

```bash
npm run dev
```

Expected: starts at http://localhost:3000, redirects to /jobs (404 is fine at this point).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: bootstrap Next.js project with Prisma and Vitest"
```

---

### Task 2: Database Schema

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`
- Create: `src/lib/db.test.ts`
- Create: `src/types/index.ts`

**Interfaces:**
- Produces:
  - `prisma` — `PrismaClient` singleton exported from `@/lib/db`
  - All Prisma model types re-exported from `@/types/index`

- [ ] **Step 1: Write the Prisma schema**

Replace `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum JobStatus {
  draft
  estimated
  approved
}

enum AccessType {
  ground
  elevated
  confined
  overhead
}

enum LoadingClass {
  light
  medium
  heavy
}

enum ScaffoldType {
  independent
  birdcage
  putlog
  suspended
  cantilever
}

enum EstimateCategory {
  material
  labour
}

enum PhaseType {
  erect
  modify
  dismantle
}

model Job {
  id            String    @id @default(cuid())
  projectNumber String
  title         String
  client        String
  status        JobStatus @default(draft)
  startDate     DateTime
  durationWeeks Int
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  drawings      Drawing[]
  phases        Phase[]
}

model Drawing {
  id            String   @id @default(cuid())
  jobId         String
  structureId   String
  structureName String
  filename      String
  blobUrl       String
  pageCount     Int      @default(1)
  createdAt     DateTime @default(now())
  job           Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)
  zones         Zone[]
}

model Zone {
  id            String       @id @default(cuid())
  drawingId     String
  pageNumber    Int          @default(1)
  label         String
  canvasData    Json
  accessType    AccessType
  loadingClass  LoadingClass
  heightM       Float
  perimeterM    Float
  areaM2        Float
  scaffoldType  ScaffoldType
  templateId    String?
  createdAt     DateTime     @default(now())
  drawing       Drawing      @relation(fields: [drawingId], references: [id], onDelete: Cascade)
  template      Template?    @relation(fields: [templateId], references: [id])
  estimateItems EstimateItem[]
}

model EstimateItem {
  id           String           @id @default(cuid())
  zoneId       String
  category     EstimateCategory
  description  String
  quantity     Float
  unit         String
  unitManhours Float            @default(0)
  overridden   Boolean          @default(false)
  zone         Zone             @relation(fields: [zoneId], references: [id], onDelete: Cascade)
}

model Template {
  id             String             @id @default(cuid())
  name           String
  scaffoldType   ScaffoldType
  accessTypes    AccessType[]
  loadingClasses LoadingClass[]
  lineItems      TemplateLineItem[]
  zones          Zone[]
}

model TemplateLineItem {
  id          String           @id @default(cuid())
  templateId  String
  category    EstimateCategory
  description String
  formula     String
  unit        String
  template    Template         @relation(fields: [templateId], references: [id], onDelete: Cascade)
}

model Phase {
  id            String    @id @default(cuid())
  jobId         String
  type          PhaseType
  structureId   String
  startDate     DateTime
  endDate       DateTime
  manhoursTotal Float     @default(0)
  job           Job       @relation(fields: [jobId], references: [id], onDelete: Cascade)
}

model ResourcePool {
  id                String   @id @default(cuid())
  weekStartDate     DateTime @unique
  availableManhours Float
}
```

- [ ] **Step 2: Write a failing test for the db singleton**

Create `src/lib/db.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({ $connect: vi.fn() })),
}))

describe('db singleton', () => {
  it('exports a prisma instance', async () => {
    const { prisma } = await import('./db')
    expect(prisma).toBeDefined()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm run test:run -- src/lib/db.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Create db singleton**

Create `src/lib/db.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 5: Create types barrel**

Create `src/types/index.ts`:

```typescript
export type {
  Job,
  Drawing,
  Zone,
  EstimateItem,
  Template,
  TemplateLineItem,
  Phase,
  ResourcePool,
  JobStatus,
  AccessType,
  LoadingClass,
  ScaffoldType,
  EstimateCategory,
  PhaseType,
} from '@prisma/client'
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npm run test:run -- src/lib/db.test.ts
```

Expected: PASS

- [ ] **Step 7: Add env vars**

Add to `.env.local` (obtain from Vercel Marketplace → Neon integration and Vercel Blob):

```
DATABASE_URL=postgresql://...
BLOB_READ_WRITE_TOKEN=vercel_blob_...
```

- [ ] **Step 8: Generate Prisma client and migrate**

```bash
npx prisma generate
npx prisma migrate dev --name init
```

Expected: migration applied, `prisma/migrations/` created.

- [ ] **Step 9: Commit**

```bash
git add prisma/ src/lib/ src/types/
git commit -m "feat: add Prisma schema, db singleton, and initial migration"
```

---

### Task 3: Job API Routes

**Files:**
- Create: `src/app/api/jobs/route.ts`
- Create: `src/app/api/jobs/route.test.ts`
- Create: `src/app/api/jobs/[jobId]/route.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`
- Produces:
  - `GET /api/jobs` → `Job[]` with `_count.drawings`
  - `POST /api/jobs` → `Job` (201)
  - `GET /api/jobs/[jobId]` → `Job` with `drawings[]` and `phases[]`
  - `PATCH /api/jobs/[jobId]` → `Job`
  - `DELETE /api/jobs/[jobId]` → 204

- [ ] **Step 1: Write failing tests**

Create `src/app/api/jobs/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  prisma: {
    job: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { GET, POST } from './route'
import { prisma } from '@/lib/db'

describe('GET /api/jobs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns list of jobs with 200', async () => {
    const mockJobs = [{ id: '1', title: 'Test Job', projectNumber: 'PRJ-001' }]
    vi.mocked(prisma.job.findMany).mockResolvedValue(mockJobs as any)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(mockJobs)
  })
})

describe('POST /api/jobs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a job and returns 201', async () => {
    const mockJob = { id: '1', projectNumber: 'PRJ-001', title: 'Test', client: 'Ops', status: 'draft', startDate: new Date().toISOString(), durationWeeks: 4 }
    vi.mocked(prisma.job.create).mockResolvedValue(mockJob as any)

    const request = new NextRequest('http://localhost/api/jobs', {
      method: 'POST',
      body: JSON.stringify({ projectNumber: 'PRJ-001', title: 'Test', client: 'Ops', startDate: new Date().toISOString(), durationWeeks: 4 }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(201)
  })

  it('returns 400 for invalid data', async () => {
    const request = new NextRequest('http://localhost/api/jobs', {
      method: 'POST',
      body: JSON.stringify({ title: '' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run -- src/app/api/jobs/route.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement GET and POST /api/jobs**

Create `src/app/api/jobs/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createJobSchema = z.object({
  projectNumber: z.string().min(1),
  title: z.string().min(1),
  client: z.string().min(1),
  startDate: z.string().datetime(),
  durationWeeks: z.number().int().positive(),
})

export async function GET() {
  const jobs = await prisma.job.findMany({
    include: { _count: { select: { drawings: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(jobs)
}

export async function POST(request: Request) {
  const body = await request.json()
  const result = createJobSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }
  const job = await prisma.job.create({
    data: { ...result.data, startDate: new Date(result.data.startDate) },
  })
  return NextResponse.json(job, { status: 201 })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:run -- src/app/api/jobs/route.test.ts
```

Expected: PASS

- [ ] **Step 5: Implement GET, PATCH, DELETE /api/jobs/[jobId]**

Create `src/app/api/jobs/[jobId]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const updateJobSchema = z.object({
  title: z.string().min(1).optional(),
  client: z.string().min(1).optional(),
  status: z.enum(['draft', 'estimated', 'approved']).optional(),
  startDate: z.string().datetime().optional(),
  durationWeeks: z.number().int().positive().optional(),
})

type Params = { params: Promise<{ jobId: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { jobId } = await params
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      drawings: { orderBy: { structureId: 'asc' } },
      phases: { orderBy: { startDate: 'asc' } },
    },
  })
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(job)
}

export async function PATCH(request: Request, { params }: Params) {
  const { jobId } = await params
  const body = await request.json()
  const result = updateJobSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }
  const data = {
    ...result.data,
    ...(result.data.startDate ? { startDate: new Date(result.data.startDate) } : {}),
  }
  const job = await prisma.job.update({ where: { id: jobId }, data })
  return NextResponse.json(job)
}

export async function DELETE(_req: Request, { params }: Params) {
  const { jobId } = await params
  await prisma.job.delete({ where: { id: jobId } })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/jobs/
git commit -m "feat: add job CRUD API routes"
```

---

### Task 4: Drawing API Routes

**Files:**
- Create: `src/app/api/jobs/[jobId]/drawings/route.ts`
- Create: `src/app/api/jobs/[jobId]/drawings/route.test.ts`
- Create: `src/app/api/jobs/[jobId]/drawings/[drawingId]/route.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`, `put` / `del` from `@vercel/blob`
- Produces:
  - `GET /api/jobs/[jobId]/drawings` → `Drawing[]`
  - `POST /api/jobs/[jobId]/drawings` → `Drawing` (201), `multipart/form-data` with `file`, `structureId`, `structureName`
  - `GET /api/jobs/[jobId]/drawings/[drawingId]` → `Drawing` with `zones[]`
  - `DELETE /api/jobs/[jobId]/drawings/[drawingId]` → 204

- [ ] **Step 1: Write failing tests**

Create `src/app/api/jobs/[jobId]/drawings/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  prisma: { drawing: { create: vi.fn(), findMany: vi.fn() } },
}))

vi.mock('@vercel/blob', () => ({
  put: vi.fn().mockResolvedValue({ url: 'https://blob.example.com/test.pdf' }),
}))

import { POST } from './route'
import { prisma } from '@/lib/db'

describe('POST /api/jobs/[jobId]/drawings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a drawing record and returns 201', async () => {
    const mockDrawing = {
      id: 'd1', jobId: 'j1', structureId: 'STR-01',
      structureName: 'Tank A', filename: 'ga.pdf',
      blobUrl: 'https://blob.example.com/test.pdf', pageCount: 1,
    }
    vi.mocked(prisma.drawing.create).mockResolvedValue(mockDrawing as any)

    const formData = new FormData()
    formData.append('file', new Blob(['%PDF'], { type: 'application/pdf' }), 'ga.pdf')
    formData.append('structureId', 'STR-01')
    formData.append('structureName', 'Tank A')

    const request = new NextRequest('http://localhost/api/jobs/j1/drawings', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request, { params: Promise.resolve({ jobId: 'j1' }) })
    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.structureId).toBe('STR-01')
  })

  it('returns 400 when file is missing', async () => {
    const formData = new FormData()
    formData.append('structureId', 'STR-01')
    formData.append('structureName', 'Tank A')

    const request = new NextRequest('http://localhost/api/jobs/j1/drawings', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request, { params: Promise.resolve({ jobId: 'j1' }) })
    expect(response.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run -- "src/app/api/jobs/\[jobId\]/drawings/route.test.ts"
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement drawing list and upload**

Create `src/app/api/jobs/[jobId]/drawings/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/db'

type Params = { params: Promise<{ jobId: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { jobId } = await params
  const drawings = await prisma.drawing.findMany({
    where: { jobId },
    orderBy: { structureId: 'asc' },
  })
  return NextResponse.json(drawings)
}

export async function POST(request: Request, { params }: Params) {
  const { jobId } = await params
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const structureId = formData.get('structureId') as string | null
  const structureName = formData.get('structureName') as string | null

  if (!file || !structureId || !structureName) {
    return NextResponse.json({ error: 'file, structureId, and structureName are required' }, { status: 400 })
  }

  const blob = await put(`drawings/${jobId}/${file.name}`, file, { access: 'public' })

  const drawing = await prisma.drawing.create({
    data: { jobId, structureId, structureName, filename: file.name, blobUrl: blob.url },
  })

  return NextResponse.json(drawing, { status: 201 })
}
```

Create `src/app/api/jobs/[jobId]/drawings/[drawingId]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { prisma } from '@/lib/db'

type Params = { params: Promise<{ jobId: string; drawingId: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { drawingId } = await params
  const drawing = await prisma.drawing.findUnique({
    where: { id: drawingId },
    include: { zones: true },
  })
  if (!drawing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(drawing)
}

export async function DELETE(_req: Request, { params }: Params) {
  const { drawingId } = await params
  const drawing = await prisma.drawing.findUnique({ where: { id: drawingId } })
  if (!drawing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await del(drawing.blobUrl)
  await prisma.drawing.delete({ where: { id: drawingId } })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:run -- "src/app/api/jobs/\[jobId\]/drawings/route.test.ts"
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/jobs/
git commit -m "feat: add drawing upload and retrieval API routes"
```

---

### Task 5: Layout + shadcn/ui

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/components/nav.tsx`
- Create: `src/components/ui/` (via shadcn CLI)

**Interfaces:**
- Produces: Shared app layout with nav bar rendered on every page; shadcn components available for import

- [ ] **Step 1: Initialise shadcn/ui**

```bash
npx shadcn@latest init --defaults
```

Expected: `components.json` created, base styles written to `src/app/globals.css`.

- [ ] **Step 2: Add required components**

```bash
npx shadcn@latest add button input label select table card badge dialog form
```

Expected: component files created under `src/components/ui/`.

- [ ] **Step 3: Create nav component**

Create `src/components/nav.tsx`:

```typescript
import Link from 'next/link'

export function Nav() {
  return (
    <header className="border-b">
      <div className="container mx-auto flex h-14 items-center gap-6 px-4">
        <Link href="/jobs" className="font-semibold text-sm">
          Scaffolding Platform
        </Link>
        <nav className="flex gap-4 text-sm text-muted-foreground">
          <Link href="/jobs" className="hover:text-foreground transition-colors">Jobs</Link>
          <Link href="/schedule" className="hover:text-foreground transition-colors">Schedule</Link>
          <Link href="/resources" className="hover:text-foreground transition-colors">Resources</Link>
        </nav>
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Update root layout**

Replace `src/app/layout.tsx`:

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/nav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Scaffolding Platform',
  description: 'Internal scaffolding design and estimation tool',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Nav />
        <main className="container mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Verify layout renders**

```bash
npm run dev
```

Navigate to http://localhost:3000 — expect nav bar with three links, redirect to /jobs.

- [ ] **Step 6: Commit**

```bash
git add src/app/layout.tsx src/components/nav.tsx src/components/ui/ components.json
git commit -m "feat: add shadcn/ui and shared app layout"
```

---

### Task 6: Job Dashboard Page

**Files:**
- Create: `src/app/jobs/page.tsx`
- Create: `src/components/jobs/job-status-badge.tsx`
- Create: `src/components/jobs/job-list.tsx`
- Create: `src/components/jobs/job-list.test.tsx`

**Interfaces:**
- Consumes: `prisma.job.findMany` (server component, no API call)
- Produces: `/jobs` — table of all jobs; clicking a title navigates to `/jobs/[jobId]`

- [ ] **Step 1: Write failing component test**

Create `src/components/jobs/job-list.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { JobList } from './job-list'

const mockJobs = [
  {
    id: '1',
    projectNumber: 'PRJ-001',
    title: 'Refinery Turnaround',
    client: 'Ops Team',
    status: 'draft' as const,
    startDate: '2026-07-01T00:00:00.000Z',
    durationWeeks: 8,
    _count: { drawings: 3 },
  },
]

describe('JobList', () => {
  it('renders job data in a table row', () => {
    render(<JobList jobs={mockJobs} />)
    expect(screen.getByText('PRJ-001')).toBeInTheDocument()
    expect(screen.getByText('Refinery Turnaround')).toBeInTheDocument()
    expect(screen.getByText('Ops Team')).toBeInTheDocument()
    expect(screen.getByText('8w')).toBeInTheDocument()
  })

  it('shows empty state when no jobs', () => {
    render(<JobList jobs={[]} />)
    expect(screen.getByText(/no jobs/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/components/jobs/job-list.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create JobStatusBadge**

Create `src/components/jobs/job-status-badge.tsx`:

```typescript
import { Badge } from '@/components/ui/badge'
import { JobStatus } from '@/types'

const variantMap: Record<JobStatus, 'secondary' | 'default' | 'outline'> = {
  draft: 'secondary',
  estimated: 'default',
  approved: 'outline',
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <Badge variant={variantMap[status]}>{status}</Badge>
}
```

- [ ] **Step 4: Create JobList**

Create `src/components/jobs/job-list.tsx`:

```typescript
import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { JobStatusBadge } from './job-status-badge'
import { JobStatus } from '@/types'

type JobRow = {
  id: string
  projectNumber: string
  title: string
  client: string
  status: JobStatus
  startDate: string
  durationWeeks: number
  _count: { drawings: number }
}

export function JobList({ jobs }: { jobs: JobRow[] }) {
  if (jobs.length === 0) {
    return <p className="text-muted-foreground text-sm">No jobs found. Create your first job.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Project #</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Drawings</TableHead>
          <TableHead>Start Date</TableHead>
          <TableHead>Duration</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((job) => (
          <TableRow key={job.id}>
            <TableCell className="font-mono text-sm">{job.projectNumber}</TableCell>
            <TableCell>
              <Link href={`/jobs/${job.id}`} className="hover:underline font-medium">
                {job.title}
              </Link>
            </TableCell>
            <TableCell>{job.client}</TableCell>
            <TableCell><JobStatusBadge status={job.status} /></TableCell>
            <TableCell>{job._count.drawings}</TableCell>
            <TableCell>{new Date(job.startDate).toLocaleDateString()}</TableCell>
            <TableCell>{job.durationWeeks}w</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm run test:run -- src/components/jobs/job-list.test.tsx
```

Expected: PASS

- [ ] **Step 6: Create Job Dashboard page**

Create `src/app/jobs/page.tsx`:

```typescript
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { JobList } from '@/components/jobs/job-list'
import { prisma } from '@/lib/db'

export default async function JobsPage() {
  const jobs = await prisma.job.findMany({
    include: { _count: { select: { drawings: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Jobs</h1>
        <Button asChild>
          <Link href="/jobs/new">New Job</Link>
        </Button>
      </div>
      <JobList jobs={jobs} />
    </div>
  )
}
```

- [ ] **Step 7: Verify in browser**

```bash
npm run dev
```

Navigate to http://localhost:3000/jobs — expect empty job table with "New Job" button.

- [ ] **Step 8: Commit**

```bash
git add src/app/jobs/page.tsx src/components/jobs/
git commit -m "feat: add job dashboard page"
```

---

### Task 7: Create Job Form

**Files:**
- Create: `src/app/jobs/new/page.tsx`
- Create: `src/components/jobs/create-job-form.tsx`
- Create: `src/components/jobs/create-job-form.test.tsx`

**Interfaces:**
- Consumes: `POST /api/jobs`
- Produces: `/jobs/new` — form that creates a job and redirects to `/jobs/[jobId]`

- [ ] **Step 1: Write failing tests**

Create `src/components/jobs/create-job-form.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreateJobForm } from './create-job-form'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

global.fetch = vi.fn()

describe('CreateJobForm', () => {
  it('renders all required fields', () => {
    render(<CreateJobForm />)
    expect(screen.getByLabelText(/project number/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/client/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/duration/i)).toBeInTheDocument()
  })

  it('submits to POST /api/jobs and redirects on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'new-id' }),
    } as Response)

    render(<CreateJobForm />)

    fireEvent.change(screen.getByLabelText(/project number/i), { target: { value: 'PRJ-001' } })
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Test Job' } })
    fireEvent.change(screen.getByLabelText(/client/i), { target: { value: 'Ops' } })
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-07-01' } })
    fireEvent.change(screen.getByLabelText(/duration/i), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: /create job/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/jobs', expect.objectContaining({ method: 'POST' }))
      expect(mockPush).toHaveBeenCalledWith('/jobs/new-id')
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run -- src/components/jobs/create-job-form.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement CreateJobForm**

Create `src/components/jobs/create-job-form.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function CreateJobForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const body = {
      projectNumber: form.get('projectNumber') as string,
      title: form.get('title') as string,
      client: form.get('client') as string,
      startDate: new Date(form.get('startDate') as string).toISOString(),
      durationWeeks: Number(form.get('durationWeeks')),
    }
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const job = await res.json()
      router.push(`/jobs/${job.id}`)
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div className="space-y-1">
        <Label htmlFor="projectNumber">Project Number</Label>
        <Input id="projectNumber" name="projectNumber" placeholder="PRJ-2026-001" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" placeholder="Refinery Turnaround" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="client">Client</Label>
        <Input id="client" name="client" placeholder="Operations Team" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="startDate">Start Date</Label>
        <Input id="startDate" name="startDate" type="date" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="durationWeeks">Duration (weeks)</Label>
        <Input id="durationWeeks" name="durationWeeks" type="number" min="1" required />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? 'Creating…' : 'Create Job'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 4: Create New Job page**

Create `src/app/jobs/new/page.tsx`:

```typescript
import { CreateJobForm } from '@/components/jobs/create-job-form'

export default function NewJobPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New Job</h1>
      <CreateJobForm />
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test:run -- src/components/jobs/create-job-form.test.tsx
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/jobs/new/ src/components/jobs/create-job-form.tsx src/components/jobs/create-job-form.test.tsx
git commit -m "feat: add create job form"
```

---

### Task 8: Job Detail Page + Upload Drawing

**Files:**
- Create: `src/app/jobs/[jobId]/page.tsx`
- Create: `src/components/drawings/drawing-list.tsx`
- Create: `src/components/drawings/drawing-list.test.tsx`
- Create: `src/components/drawings/upload-drawing-form.tsx`

**Interfaces:**
- Consumes: `prisma.job.findUnique` with `drawings`, `POST /api/jobs/[jobId]/drawings`
- Produces: `/jobs/[jobId]` — job header, drawings grouped by structure, upload form; clicking a drawing filename navigates to `/jobs/[jobId]/drawings/[drawingId]` (implemented in Plan 2)

- [ ] **Step 1: Write failing test for DrawingList**

Create `src/components/drawings/drawing-list.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DrawingList } from './drawing-list'

const mockDrawings = [
  { id: 'd1', structureId: 'STR-01', structureName: 'Tank A', filename: 'ga-tank-a.pdf', blobUrl: 'https://blob.example.com/a.pdf', pageCount: 2, createdAt: new Date().toISOString() },
  { id: 'd2', structureId: 'STR-01', structureName: 'Tank A', filename: 'ga-tank-a-rev2.pdf', blobUrl: 'https://blob.example.com/b.pdf', pageCount: 1, createdAt: new Date().toISOString() },
  { id: 'd3', structureId: 'STR-02', structureName: 'Column C3', filename: 'ga-col-c3.pdf', blobUrl: 'https://blob.example.com/c.pdf', pageCount: 3, createdAt: new Date().toISOString() },
]

describe('DrawingList', () => {
  it('renders structure group headings', () => {
    render(<DrawingList drawings={mockDrawings} jobId="j1" />)
    expect(screen.getByText('Tank A')).toBeInTheDocument()
    expect(screen.getByText('Column C3')).toBeInTheDocument()
  })

  it('renders all drawing filenames', () => {
    render(<DrawingList drawings={mockDrawings} jobId="j1" />)
    expect(screen.getByText('ga-tank-a.pdf')).toBeInTheDocument()
    expect(screen.getByText('ga-tank-a-rev2.pdf')).toBeInTheDocument()
    expect(screen.getByText('ga-col-c3.pdf')).toBeInTheDocument()
  })

  it('shows empty state when no drawings', () => {
    render(<DrawingList drawings={[]} jobId="j1" />)
    expect(screen.getByText(/no drawings/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/components/drawings/drawing-list.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create DrawingList**

Create `src/components/drawings/drawing-list.tsx`:

```typescript
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type DrawingItem = {
  id: string
  structureId: string
  structureName: string
  filename: string
  blobUrl: string
  pageCount: number
  createdAt: string
}

export function DrawingList({ drawings, jobId }: { drawings: DrawingItem[]; jobId: string }) {
  if (drawings.length === 0) {
    return <p className="text-muted-foreground text-sm">No drawings uploaded yet.</p>
  }

  const byStructure = drawings.reduce<Record<string, DrawingItem[]>>((acc, d) => {
    acc[d.structureId] = acc[d.structureId] ?? []
    acc[d.structureId].push(d)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {Object.entries(byStructure).map(([structureId, items]) => (
        <Card key={structureId}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {items[0].structureName}
              <span className="ml-2 text-sm font-normal text-muted-foreground">({structureId})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {items.map((d) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <Link href={`/jobs/${jobId}/drawings/${d.id}`} className="hover:underline text-foreground">
                    {d.filename}
                  </Link>
                  <span className="text-muted-foreground">{d.pageCount}p</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create UploadDrawingForm**

Create `src/components/drawings/upload-drawing-form.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function UploadDrawingForm({ jobId }: { jobId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const res = await fetch(`/api/jobs/${jobId}/drawings`, {
      method: 'POST',
      body: formData,
    })
    if (res.ok) {
      router.refresh()
      e.currentTarget.reset()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
      <div className="space-y-1">
        <Label htmlFor="structureId">Structure ID</Label>
        <Input id="structureId" name="structureId" placeholder="STR-01" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="structureName">Structure Name</Label>
        <Input id="structureName" name="structureName" placeholder="Tank A" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="file">GA Drawing (PDF)</Label>
        <Input id="file" name="file" type="file" accept=".pdf" required />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? 'Uploading…' : 'Upload Drawing'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 5: Create Job Detail page**

Create `src/app/jobs/[jobId]/page.tsx`:

```typescript
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
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
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-mono">{job.projectNumber}</p>
          <h1 className="text-2xl font-semibold">{job.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {job.client} · {job.durationWeeks} weeks · starts {new Date(job.startDate).toLocaleDateString()}
          </p>
        </div>
        <JobStatusBadge status={job.status} />
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

- [ ] **Step 6: Run test to verify it passes**

```bash
npm run test:run -- src/components/drawings/drawing-list.test.tsx
```

Expected: PASS

- [ ] **Step 7: Run all tests**

```bash
npm run test:run
```

Expected: All tests pass.

- [ ] **Step 8: Manual end-to-end test**

```bash
npm run dev
```

1. http://localhost:3000/jobs → empty table with "New Job" button
2. Click "New Job" → fill in form → submit → redirected to job detail page
3. Fill in Structure ID + Name + PDF file → click "Upload Drawing" → drawing appears grouped under structure card
4. Clicking a drawing filename → 404 (expected — Drawing Editor is Plan 2)

- [ ] **Step 9: Commit**

```bash
git add src/app/jobs/[jobId]/ src/components/drawings/
git commit -m "feat: add job detail page with drawing upload"
```

---

## What's Next

Plan 1 delivers: job creation, drawing upload, and the job management UI.

**Plan 2: Drawing Editor** — PDF.js rendering of uploaded drawings, Konva.js zone annotation canvas, zone parameter panel, zone save/edit API routes.

**Plan 3: Estimation Engine** — template CRUD, scaffold type suggestion logic, estimate generation from zone parameters, editable estimate sheet.

**Plan 4: Level 4 Schedule & Resources** — phase management, Gantt view, ResourcePool, weekly demand histogram.

**Plan 5: Export & Reporting** — PDF report generation, Excel export, schedule export.
