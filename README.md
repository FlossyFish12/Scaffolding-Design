# Scaffolding Design Platform — MAIN

**Single source of truth** — merged 2026-08-24 from `scaffolding-web` + `scaffold_weights_estimator.py`, now P1→P5 shipped.

- **Location:** `Yard Projects/scaffolding-design`
- **GitHub:** `FlossyFish12/Scaffolding-Design` (public, `main` 30+ commits, shared `Rady193`)
- **Live:** `http://localhost:3000` (dev, Turbopack), `144eefe..faff7d6` on `origin/main`
- **Stack:** Next.js 16 (Turbopack) + React 19 + Prisma 7 + PostgreSQL + Vercel Blob + Konva + PDF.js + Three.js + Tailwind + shadcn/ui + zod + dxf-parser

## Quick Start

```bash
npm install
npm run dev          # → http://localhost:3000/jobs
npm run test:run     # 148 tests (23 suites)
npm run build
# env: DATABASE_URL, BLOB_READ_WRITE_TOKEN — see .env.local
```

## Features — Shipped One-by-One

| Phase | Feature | Key Files |
|-------|---------|-----------|
| **P1** | **Fix build** `ssr:false` in Server Component | `src/app/jobs/[jobId]/drawings/[drawingId]/page.tsx:1` → static import |
|       | **Live calc in ZonePanel** — TG20 + density + MTO + warnings | `src/components/drawing-editor/zone-panel.tsx:1` `Engineering Preview` collapse, `runCalc`/`calculateDensity`/`calculateMto`, bay/lift/boards/wind/tie/ground inputs, `derivedNumBays`, HBR>3.5 |
|       | **MTO→Estimate sync** — 10% waste `[MTO]` materials | `src/app/api/.../estimate/route.ts:63` `calculateMto` → `mergedNewItems`, respects `overridden` |
|       | **Phase→Resource re-calc** | same route: sum `labour quantity*unitManhours` per `structureId` → `Phase.manhoursTotal` |
|       | **Tie/HBR warnings** | `zone-panel.tsx` `!hbr_ok` `!bay_ok` `!lift_ok` |
| **P2** | **Job TG20 summary** on Estimate | `src/components/estimate/compliance-summary.tsx:1` aggregates `runCalc` per zone, badge `✓/⚠` |
|       | **Pricing** `manhours→AED` | `src/components/estimate/estimate-sheet.tsx:43` `rateAedPerHour 45` editable, `Cost AED` column, totals |
|       | **Scale calibration** | `src/components/drawing-editor/drawing-editor.tsx:51` `m/100px` input, `draftDerived` `perimeter 2*(w+h)*scale` `area w*h*scale²` auto-fill new zone |
| **P3** | **3D preview** Three.js | `src/components/preview/scaffold-3d-preview.tsx:1` `OrbitControls`, standards/ledgers/boards/guards/ties, dark `#0f172a`; in `ZonePanel` + `/calc` TG20 & density |
|       | **DXF import** | `src/components/drawings/dxf-preview.tsx:1` `dxf-parser` dynamic, entity count `LINE/CIRCLE etc` + `IfcPreview` |
|       | **Crew calendar** | `src/components/schedule/crew-calendar.tsx:1` `computeWeeklyDemand` vs `ResourcePool`, overloaded banner, editable capacity `POST /api/resource-pool`, 400h/wk default |
| **P4** | **Safety checklist** | `src/components/safety/checklist.tsx:1` 10 TG20/EN12811 checks, inspector+date, localStorage per `zoneId`, CSV export; pages `/safety` + `/jobs/[jobId]/safety` + ZonePanel per-zone |
|       | **Inventory** | `src/components/inventory/inventory-panel.tsx:1` `tube48/board/coupler/base/sole/tie` stock vs reserved, available, threshold low-stock, editable, CSV; page `/inventory` |
|       | **AI auto-detect** | `src/components/drawing-editor/drawing-editor.tsx:259` `✨ AI Detect` button — splits page into 2 zones, scale-derived perim/area, `POST` zones |
| **P5** | **IFC/TEKLA** | `src/components/import/ifc-preview.tsx:1` text scan `IFCWALL/SLAB/BEAM/COLUMN`, project name, scaffold suggestion per counts |
|       | **Offline PWA** | `src/app/manifest.ts:1` + `public/sw.js:1` `scaffold-v1` cache `/jobs /calc /safety /inventory`, `src/components/pwa/register-sw.tsx:1`, `layout.tsx:8` `themeColor` |
|       | **Billing** | `src/components/billing/invoice.tsx:1` `manhours*rate` + `VAT 5%` + discount, CSV, pages `/billing` + `/jobs/[jobId]/billing` |
|       | **Roles & approvals** | `src/components/jobs/status-workflow.tsx:1` `designer/engineer/manager` `draft→estimated→approved`, `PATCH /api/jobs/[jobId]` + audit `localStorage audit-{jobId}` |

## Routes

- `/jobs` — dashboard (`JobList`)
- `/jobs/[jobId]` — detail + `UploadDrawingForm` (PDF `accept .pdf`) + `DxfPreview` + `IfcPreview` + `StatusWorkflow`
- `/jobs/[jobId]/drawings/[drawingId]` — PDF editor `PdfViewer` + `CanvasLayer` (Konva) + scale `m/100px` + AI detect
- `/jobs/[jobId]/estimate` — `EstimateSheet` + `ComplianceSummary` (TG20 per zone)
- `/jobs/[jobId]/billing` — `Invoice` (labour lines → AED + VAT)
- `/jobs/[jobId]/safety` — per-job checklists (global + per-zone)
- `/calc` — TG20 & Structural + Density (2 tabs) + `ElevationView` SVG + `MtoPanel` + 3D
- `/safety`, `/inventory`, `/billing` — standalone
- `/schedule` (Gantt) + `/resources` (histogram + `CrewCalendar`)
- `/api/calc` — `POST {height_m, bay_length_m, lift_height_m, boards, num_bays, load_class, wind_zone, tie_pattern, ground_bearing_kpa}` or `{mode:'density', ...}`; `/api/.../estimate` now includes MTO

## Calc Engine (`src/lib/calc/`)

- `types.ts` — `ScaffoldParams`, `CalcResult`, `ComplianceResult`, `StructuralResult`, `DensityResult`
- `parameters.ts` — zod `lift 1.5–2.7`, `boards 3–5`, `load 1–6`, `wind 1–4`, warnings `>30m` `bay non-standard`
- `tg20Compliance.ts` — `standard_configurations` lookup `data/tg20Tables.json` (representative)
- `structural.ts` — Euler `NbRd = χ·A·fy/γM1` `imperfection 0.21`, `base 22500mm²`
- `mto.ts` — standards/ledgers/transoms/boards/base/sole/ties/couplers (e.g., `275m tube 22×12.5m`)
- `density.ts` — `calculateDensity` port of `scaffold_weights_estimator.py:346` `TUBE_SPECS×6` `BOARD_SPECS×3` `HBR 3.5`
- `output.ts` — `generateCalcSheet()` + `generateMethodStatement()` markdown
- `__tests__` — `density.test.ts` (5), `parameters`, `structural`, `tg20`, `output`, `integration` → 33 calc tests

## Data Model

`Job (projectNumber/status/durationWeeks) → Drawing (structureId/structureName/blobUrl/pageCount) → Zone (pageNumber/canvasData/accessType/loadingClass/heightM/perimeterM/areaM2/scaffoldType/templateId) → EstimateItem (category/quantity/unit/unitManhours/overridden)` + `Template → TemplateLineItem (formula)` + `Phase (type erect/modify/dismantle/structureId/manhoursTotal)` + `ResourcePool (weekStartDate/availableManhours)`

## Polish (P6)

- **Tests:** 148 passed (23 suites) — new `density.test.ts`, `compliance-summary.test.tsx`, `invoice.test.tsx`
- **Build:** `next build` OK (16 routes inc `/safety` `/inventory` `/billing` `/manifest.webmanifest`)
- **Lint:** `eslint` clean (run `npm run lint`)
- **Deploy:** Vercel — `vercel --prod` (requires `DATABASE_URL` + `BLOB_READ_WRITE_TOKEN`), or `npm run build` + `npm start`

## Archive

- `../_archive/scaffolding-web-2026-08-24` — frozen `scaffolding-web`
- `~/scaffold_weights_estimator.py` — curses TUI (ported to `lib/calc/density.ts`) + `tools/scaffold_weights_estimator.py`
- `.next` `node_modules` — build artifacts (gitignored)

## Dev Notes

- Scale calibration: set `m/100px` from known dimension before drawing; new zone auto-fills `perimeter/area`
- AI detect is grid-split demo — replace with vision model (`light-fea` pattern) for production
- IFC is text-scan preview — upgrade to `web-ifc` geometry streaming for full 3D storey import
- Inventory & safety are `localStorage` for demo — migrate to `Prisma` + `ResourcePool` style for multi-user
