# Scaffolding Design Platform — MAIN

**Single source of truth** for all scaffolding design work. Merged 2026-08-24 from `scaffolding-web` + `scaffold_weights_estimator.py`.

- **Location:** `/Users/abdelaziz/Yard Projects/scaffolding-design`
- **GitHub:** `FlossyFish12/Scaffolding-Design` (public, `main` pushed)
- **Stack:** Next.js 16 + React 19 + Prisma 7 + PostgreSQL + Vercel Blob + Konva + PDF.js + Tailwind + shadcn/ui + zod

## Features

| Area | Description |
|------|-------------|
| **Jobs → Drawings → Zones** | PDF GA upload, Konva canvas zones (polygon/rect), per-zone `heightM/perimeterM/areaM2`, `accessType/loadingClass` → auto-suggest `scaffoldType` (`scaffold-rules.ts:3`) |
| **Estimate Engine** | Template line items with formula `area_m2 × height_m × 0.15` (`estimate-engine.ts:22`), editable `EstimateItem` with `overridden` flag, rollup Zone→Structure→Job→Project |
| **Schedule (Level 4)** | Gantt `src/components/schedule/gantt-chart.tsx`, phases `erect/modify/dismantle` per structure, draggable bars, weekly manhour demand |
| **Resources** | Histogram `resource-histogram.tsx`, `ResourcePool` weekly capacity, overload highlighted red |
| **Engineering Calc (`/calc`)** | **NEW 2026-08-24** — TG20:13 table compliance, EN 1993-1-1 buckling, BS EN 5975 ground bearing, calc sheet + method statement (`lib/calc/`) |
| **MTO & Elevation** | **NEW** — `calculateMto()` + `ElevationView` SVG per bay, markdown MTO download |
| **Density (`/calc` density tab + `/api/calc?mode=density`)** | **NEW** — Port of `scaffold_weights_estimator.py:346` — TUBE_SPECS ×6, BOARD_SPECS ×3, birdcage/independent/putlog, coupler/board toggles, HBR & tie density |
| **Exports** | Estimate Excel (per-structure sheets + formulas), Schedule Excel, PDF report via `@react-pdf/renderer`, CSV/JSON for density |

## Routes

- `/jobs` — dashboard
- `/jobs/[jobId]` — detail + drawings + phases
- `/jobs/[jobId]/drawings/[drawingId]` — PDF editor + zone panel
- `/jobs/[jobId]/estimate` — estimate sheet
- `/calc` — engineering calculator (TG20 & Density tabs)
- `/api/calc` — POST `{height_m, bay_length_m, lift_height_m, boards, num_bays, load_class, wind_zone, tie_pattern, ground_bearing_kpa}` or `{mode:'density', bay_length, ...}`
- `/schedule`, `/resources` — Gantt & histogram

## Calc Engine (`src/lib/calc/`)

- `types.ts` — `ScaffoldParams`, `CalcResult`, `ComplianceResult`, `StructuralResult`
- `parameters.ts` — zod validation (lift 1.5–2.7m, boards 3–5, load class 1–6, wind 1–4)
- `tg20Compliance.ts` — finds `standard_configurations` in `data/tg20Tables.json` (representative values)
- `structural.ts` — Euler `NbRd = χ·A·fy/γM1` with `imperfection 0.21`, base plate `bearingArea 22500mm²`
- `mto.ts` — standards/ledgers/transoms/boards/base plates/sole boards/ties/couplers quantities
- `output.ts` — `generateCalcSheet()` + `generateMethodStatement()` markdown
- `density.ts` — port of `scaffold_weights_estimator.py` TUBE_SPECS/BOARD_SPECS, volume densities
- `data/tg20Tables.json` + `tubeProperties.json`

## Stales Cleaned 2026-08-24

- `scaffolding-web` (FlossyFish12/scaffolding-web) → **deprecated**, archived to `_archive/scaffolding-web-2026-08-24`, `DEPRECATED.md` pushed
- `Scaffold_Weights_Estimator.py` (capital) → normalized to `scaffold_weights_estimator.py` (single inode, case-insensitive FS)
- `Scaffolding-Design` GitHub empty (size 0) → pushed local `main` (5048f33+) to `origin/main`, fixed `url.insteadOf` ssh rewrite
- `.next` 966M + `node_modules` 1.0G are build artifacts (not committed, `.gitignore`)
- `scaffolding-design/node_modules` stale in `scaffolding-web` missing → now shared via main

## Dev

```bash
npm run dev          # http://localhost:3000 → /jobs
npm run test:run     # 138 tests (105 + 33 calc)
npm run build
```

## Archive

- `../_archive/scaffolding-web-2026-08-24` — frozen copy of secondary project
- `~/scaffold_weights_estimator.py` — standalone curses TUI (also ported to `lib/calc/density.ts`)
