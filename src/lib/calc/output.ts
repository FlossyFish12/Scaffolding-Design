import { ScaffoldParams, ComplianceResult, StructuralResult } from './types'

const LOAD_CLASS_DATA: Record<number, string> = {
  1: '0.75 kN/m²', 2: '1.5 kN/m²', 3: '2.0 kN/m²',
  4: '3.0 kN/m²', 5: '4.5 kN/m²', 6: '6.0 kN/m²',
}

const TIE_FREQUENCY: Record<string, string> = {
  alternate: 'Every alternate bay and lift',
  every_lift: 'Every lift',
  every_bay: 'Every bay',
}

function verdict(tg20: ComplianceResult, structural: StructuralResult | null): string {
  if (tg20.compliant) return '**COMPLIANT — configuration satisfies TG20:13 requirements**'
  if (structural?.requiresEngineer) return '**REQUIRES ENGINEER SIGN-OFF — first-principles checks failed**'
  return '**NON-COMPLIANT — exceeds TG20:13 limits**'
}

function tg20Section(tg20: ComplianceResult): string {
  if (!tg20.standardConfigFound) {
    return '_No matching TG20:13 standard configuration found — first-principles analysis applied._\n'
  }
  const rows = tg20.checks
    .map(c => `| ${c.name} | ${c.passed ? 'PASS' : 'FAIL'} | ${c.actual} ${c.unit} | ${c.limit} ${c.unit} | ${c.clause} |`)
    .join('\n')
  return `| Check | Result | Actual | Limit | Clause |\n|-------|--------|--------|-------|--------|\n${rows}\n`
}

function structuralSection(structural: StructuralResult | null, tg20: ComplianceResult): string {
  if (tg20.compliant) return '_Not required — TG20 standard configuration confirmed compliant._\n'
  if (!structural) return ''
  const rows = structural.checks
    .map(c => `| ${c.name} | ${c.passed ? 'PASS' : 'FAIL'} | ${c.actual} ${c.unit} | ${c.limit} ${c.unit} | ${c.clause} |`)
    .join('\n')
  return `| Check | Result | Actual | Limit | Clause |\n|-------|--------|--------|-------|--------|\n${rows}\n`
}

export function generateCalcSheet(
  params: ScaffoldParams,
  tg20: ComplianceResult,
  structural: StructuralResult | null,
  warnings: string[],
): string {
  const date = new Date().toISOString().slice(0, 10)
  const warningsSection = warnings.length > 0 ? warnings.map(w => `- ${w}`).join('\n') : '_None_'

  return `# Scaffolding Calculation Sheet

**Job Reference:** ${params.job_ref}
**Date:** ${date}
**Standard:** NASC TG20:13 / BS EN 5975

---

## Input Parameters

| Parameter | Value |
|-----------|-------|
| Height | ${params.height_m} m |
| Bay length | ${params.bay_length_m} m |
| Lift height | ${params.lift_height_m} m |
| Boards | ${params.boards} |
| Load class | ${params.load_class} (${LOAD_CLASS_DATA[params.load_class] ?? 'unknown'}) |
| Wind zone | ${params.wind_zone} |
| Tie pattern | ${params.tie_pattern} |
| Ground bearing | ${params.ground_bearing_kpa} kPa |

---

## TG20 Compliance Checks

${tg20Section(tg20)}

---

## Structural Analysis

${structuralSection(structural, tg20)}

---

## Overall Verdict

${verdict(tg20, structural)}

---

## Warnings

${warningsSection}

---

## Assumptions & Exclusions

- Tube and fitting scaffold only (TG20:13 scope)
- S235 steel tube, 48.3mm OD × 3.2mm wall per EN 39
- Ground bearing capacity as stated — not independently verified
- Dynamic, seismic, and crash deck loads excluded from this assessment
- This calculation sheet does not substitute for a Chartered Engineer's sign-off where required
`
}

export function generateMethodStatement(
  params: ScaffoldParams,
  tg20: ComplianceResult,
  structural: StructuralResult | null,
  warnings: string[],
): string {
  const date = new Date().toISOString().slice(0, 10)
  const tieFreq = TIE_FREQUENCY[params.tie_pattern] ?? params.tie_pattern
  const isEngineer = structural?.requiresEngineer ?? false

  return `# Method Statement — Tube and Fitting Scaffold

**Job Reference:** ${params.job_ref}
**Date:** ${date}
**Standard:** NASC TG20:13 / BS EN 5975

---

## Scaffold Description

- Height: ${params.height_m} m
- Bay length: ${params.bay_length_m} m
- Lift height: ${params.lift_height_m} m
- Boards: ${params.boards} wide
- Load class: ${params.load_class} (${LOAD_CLASS_DATA[params.load_class] ?? 'unknown'})
- Wind zone: ${params.wind_zone}

---

## Erection Sequence

1. Prepare and level base plates on firm ground (min. ${params.ground_bearing_kpa} kPa bearing capacity)
2. Erect standards at ${params.bay_length_m} m bay spacing, plumb and level
3. Fix ledgers at ${params.lift_height_m} m lift height
4. Install transoms and scaffold boards (${params.boards} boards wide)
5. Tie to structure: ${tieFreq} (${params.tie_pattern})
6. Erect toe boards and guard rails to all working platforms
7. Repeat lifts to full height of ${params.height_m} m

---

## Inspection Requirements

Inspections required per BS EN 5975 Section 8:
- Before first use
- After any modification
- After any event likely to have affected stability
- At intervals not exceeding 7 days

---

## Handover Checklist

- [ ] Inspection record completed
- [ ] Scaffold tag in place
- [ ] Loading notices displayed
- [ ] Site manager briefed on load restrictions

---

## Sign-off

${isEngineer ? '> ⚠️ CHARTERED ENGINEER SIGN-OFF REQUIRED before use\n\n' : ''}Designer: _________________________ Date: _________

Site Manager: ____________________ Date: _________
`
}
