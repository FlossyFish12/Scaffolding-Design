# Scaffolding Design Platform — Design Spec

**Date:** 2026-06-29
**Status:** Approved

---

## Overview

An internal web platform for designing scaffolding around structures, estimating materials and manhours, and scheduling resources across multiple concurrent projects. Input is PDF GA drawings; output is itemised estimates, reports, and a Level 4 resource schedule.

---

## Architecture

**Stack:**
- Next.js 15 (App Router) — frontend and API routes
- Tailwind CSS + shadcn/ui — UI components
- PDF.js — in-browser PDF rendering
- Konva.js — canvas annotation layer over PDF pages
- PostgreSQL (Vercel Marketplace) — primary database
- Vercel Blob — PDF file storage
- `xlsx` — Excel export
- `@react-pdf/renderer` — PDF report generation

**Deployment:** Vercel (internal use)

---

## Data Model

```
Job
├── id
├── project_number        (e.g. "PRJ-2024-047")
├── title
├── client                (internal team/dept)
├── status                (draft | estimated | approved)
├── start_date
├── duration_weeks
├── created_at, updated_at
├── drawings[]
│   └── Drawing
│       ├── id, job_id
│       ├── structure_id  (e.g. "STR-01", "Tank-A")
│       ├── structure_name
│       ├── filename, blob_url, page_count
│       └── zones[]
│           └── Zone
│               ├── id, drawing_id, page_number
│               ├── label
│               ├── canvas_data     (Konva shape JSON)
│               ├── access_type     (ground | elevated | confined | overhead)
│               ├── loading_class   (light | medium | heavy)
│               ├── height_m, perimeter_m, area_m2
│               ├── scaffold_type   (independent | birdcage | putlog | suspended | cantilever)
│               ├── template_id     (FK → Template, nullable)
│               └── estimate_items[]
│                   └── EstimateItem
│                       ├── id, zone_id
│                       ├── category  (material | labour)
│                       ├── description
│                       ├── quantity, unit, unit_manhours
│                       └── overridden (bool)
└── phases[]
    └── Phase
        ├── id, job_id
        ├── type            (erect | modify | dismantle)
        ├── structure_id    (which structure this phase covers)
        ├── start_date, end_date
        └── manhours_total  (derived from estimate items for this structure)

Template
├── id, name, scaffold_type
├── access_type[]         (which access types this template applies to)
├── loading_class[]       (which loading classes this template applies to)
└── line_items[]          (formula-based seed rows referencing zone dimensions)

ResourcePool
├── id
├── week_start_date
└── available_manhours    (total crew capacity for that week)
```

---

## Scaffold Type Auto-Suggestion

Server-side rule applied when a zone's access type and loading class are set:

| Access Type | Loading Class  | Suggested Scaffold Type |
|-------------|----------------|-------------------------|
| Ground      | Light / Medium | Independent             |
| Ground      | Heavy          | Birdcage                |
| Elevated    | Any            | Cantilever              |
| Overhead    | Any            | Suspended               |
| Confined    | Any            | Birdcage                |

User can override the suggestion before generating the estimate.

---

## Estimation Engine

1. User defines a zone with `scaffold_type`, `access_type`, `loading_class`, `height_m`, `perimeter_m`, `area_m2`
2. A template is matched (auto by scaffold_type + access_type + loading_class, or manually selected)
3. Each template line item carries a formula referencing zone dimensions, e.g.:

```
Labour | Erect & dismantle | area_m2 × height_m × 0.15 | hrs
```

4. Generated line items populate the Estimate Sheet as editable rows
5. `overridden: true` cells are excluded from recalculation if zone dimensions change
6. Manhours per phase = sum of labour item quantities for that structure and phase type
7. Weekly manhours = phase total ÷ phase duration in weeks (even distribution, adjustable)

**Rollup hierarchy:** Zone → Structure → Job → Project

---

## Screens

### 1. Job Dashboard
- List of all jobs across all projects
- Columns: project #, title, status, structure count, start date, duration
- Filterable by status and date range
- Create New Job (project #, title, client, start date, duration_weeks)

### 2. Job Detail
- Drawings grouped by structure (structure_id + structure_name)
- Phases list (erect / modify / dismantle) with dates per structure
- Upload PDF drawing → assign structure_id and structure_name
- Navigate to Drawing Editor per drawing

### 3. Drawing Editor (core screen)
- PDF page rendered via PDF.js
- Konva.js canvas overlay for drawing zones (polygon or rectangle)
- Zone Panel (right sidebar):
  - Label, access type, loading class
  - Height, perimeter, area inputs
  - Auto-suggested scaffold type (editable dropdown)
  - Template selector (apply to zone)
  - Generate Estimate button
- Zones shown as colour-coded overlays with labels
- Page navigation for multi-page PDFs

### 4. Estimate Sheet
- Editable table per zone → line items (description, qty, unit, manhours)
- Overridden cells visually highlighted
- Rollup totals: materials by type, manhours by zone and by structure
- Export buttons: PDF Report, Excel

### 5. Level 4 Schedule (Gantt)
- Rows: Jobs → Structures → Phases
- Columns: weeks
- Bars: phase duration, colour-coded by type (erect / modify / dismantle)
- Draggable bars to adjust phase dates
- Dates update Phase records and recalculate weekly demand

### 6. Resource View
- Weekly histogram: stacked manhour demand by project
- Line overlay: available crew capacity (from ResourcePool)
- Overloaded weeks highlighted in red
- Edit available manhours per week (ResourcePool)

---

## Export & Reporting

### PDF Report (per job or per structure)
- Company header, project number, structure name, date
- Zone-by-zone material and labour breakdown
- Summary: total materials by type, total manhours, duration, peak weekly demand

### Excel Export
- One sheet per structure
- Summary sheet for the job
- Formulas intact for offline editing

### Schedule Export
- Gantt as Excel (standard construction format)
- Phases with start/end dates
- Weekly manhour demand columns

---

## What's Out of Scope (Phase 1)

- Safety & compliance (inspection checklists, certifications)
- Inventory & logistics (equipment tracking, delivery scheduling)
- TEKLA / IFC 3D model import
- AI-assisted zone detection (Phase 2 candidate)
- Monetary billing (manhours only for now)
- Multi-user roles / permissions
