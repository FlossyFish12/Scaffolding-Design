'use client'
import { useMemo } from 'react'
import { runCalc } from '@/lib/calc'
import { calculateDensity } from '@/lib/calc/density'

type ZoneForCompliance = {
  id: string
  label: string
  scaffoldType: string
  accessType: string
  loadingClass: string
  heightM: number
  perimeterM: number
  areaM2: number
}

type Props = {
  zones: ZoneForCompliance[]
}

export default function ComplianceSummary({ zones }: Props) {
  const results = useMemo(() => {
    return zones.map((z) => {
      const loadMap: Record<string, number> = { light: 2, medium: 3, heavy: 4 }
      const loadClass = loadMap[z.loadingClass] ?? 2
      const bay = 2.1
      const lift = 2.0
      const boards = 4
      const numBays = Math.max(1, Math.round((z.perimeterM || 10) / bay))
      try {
        const tg20 = runCalc({
          height_m: z.heightM || 6,
          bay_length_m: bay,
          lift_height_m: lift,
          boards,
          num_bays: numBays,
          load_class: loadClass,
          wind_zone: 2,
          tie_pattern: 'alternate',
          ground_bearing_kpa: 50,
          job_ref: z.label,
        })
        const density = calculateDensity({
          zone_name: z.label,
          bay_length: bay,
          lift_height: lift,
          num_bays: numBays,
          num_lifts: Math.ceil((z.heightM || 6) / lift),
          boarded_lifts: Math.ceil(Math.ceil((z.heightM || 6) / lift) * 0.5),
          boards_wide: boards,
          board_length: 2.4,
          tube_idx: 0,
          board_idx: 0,
          scaffold_idx: 0,
          load_class: loadClass,
        })
        return { zone: z, tg20, density, error: null as string | null }
      } catch (e) {
        return { zone: z, tg20: null, density: null, error: e instanceof Error ? e.message : 'calc failed' }
      }
    })
  }, [zones])

  const summary = useMemo(() => {
    const compliant = results.filter(r => r.tg20?.verdict === 'compliant').length
    const nonCompliant = results.filter(r => r.tg20 && r.tg20.verdict !== 'compliant').length
    const needsEngineer = results.filter(r => r.density && !r.density.hbr_ok).length
    return { compliant, nonCompliant, needsEngineer, total: results.length }
  }, [results])

  if (zones.length === 0) return null

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">TG20 Compliance — {summary.compliant}/{summary.total} zones compliant</h3>
        <span className={`text-xs px-2 py-1 rounded font-medium ${summary.nonCompliant === 0 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
          {summary.nonCompliant === 0 ? '✓ All pass' : `⚠ ${summary.nonCompliant} need review`}
        </span>
      </div>
      {summary.needsEngineer > 0 && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">⚠ {summary.needsEngineer} zone(s) exceed H/B 3.5 — engineer sign-off required</div>
      )}
      <div className="grid gap-2 md:grid-cols-2">
        {results.map(({ zone, tg20, density }) => (
          <div key={zone.id} className="rounded border p-2 text-xs">
            <div className="font-medium flex justify-between">
              <span>{zone.label} — {zone.scaffoldType}</span>
              <span className={tg20?.verdict === 'compliant' ? 'text-green-700' : 'text-amber-700'}>
                {tg20 ? (tg20.verdict === 'compliant' ? '✓ COMPLIANT' : tg20.verdict === 'requires_engineer' ? '✗ ENGINEER' : '⚠ NON-COMPLIANT') : '—'}
              </span>
            </div>
            <div className="text-muted-foreground mt-1">
              H {zone.heightM}m · P {zone.perimeterM}m · {zone.areaM2}m² · {zone.accessType}/{zone.loadingClass}
              {density && ` · H/B ${density.hbr} ${density.hbr_ok ? '✓' : '✗'}`}
            </div>
            {tg20 && tg20.checks.length > 0 && (
              <div className="mt-1 text-xs">
                {tg20.checks.map((c,i) => <div key={i} className="flex justify-between"><span>{c.name}</span><span className={c.passed?'text-green-700':'text-red-700'}>{c.actual}/{c.limit}{c.unit}</span></div>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
