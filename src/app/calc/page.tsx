'use client'
import { useState } from 'react'
import { ScaffoldForm } from '@/components/calc/ScaffoldForm'
import { ResultsPanel } from '@/components/calc/ResultsPanel'
import { ElevationView } from '@/components/calc/ElevationView'
import MtoPanel from '@/components/calc/MtoPanel'
import { runCalc } from '@/lib/calc'
import { calculateMto } from '@/lib/calc/mto'
import { calculateDensity, TUBE_SPECS, BOARD_SPECS, SCAFFOLD_TYPES } from '@/lib/calc/density'
import type { CalcResult, ScaffoldParams } from '@/lib/calc/types'

export default function CalcPage() {
  const [result, setResult] = useState<CalcResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [submittedParams, setSubmittedParams] = useState<Record<string, unknown> | null>(null)
  const [activeTab, setActiveTab] = useState<'tg20' | 'density'>('tg20')

  // density state
  const [densityInput, setDensityInput] = useState({
    zone_name: 'Zone 1',
    bay_length: 2.0,
    lift_height: 2.0,
    num_bays: 5,
    num_lifts: 6,
    boarded_lifts: 3,
    boards_wide: 5,
    board_length: 2.4,
    tube_idx: 0,
    board_idx: 0,
    scaffold_idx: 0,
    load_class: 3,
    include_couplers: true,
    include_boards: true,
  })
  const densityResult = calculateDensity(densityInput)

  function handleSubmit(params: Record<string, unknown>) {
    setIsLoading(true)
    setError(null)
    setSubmittedParams(params)
    try {
      const calcResult = runCalc(params)
      setResult(calcResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setResult(null)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--navy)' }}>Engineering Calculator</h1>
          <p className="text-sm text-muted-foreground mt-1">
            TG20:13 compliance · EN 1993-1-1 buckling · Ground bearing · MTO · Density
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setActiveTab('tg20')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${activeTab === 'tg20' ? 'bg-[var(--navy)] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              TG20 & Structural
            </button>
            <button
              onClick={() => setActiveTab('density')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${activeTab === 'density' ? 'bg-[var(--navy)] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Material Density
            </button>
          </div>
        </div>

        {activeTab === 'tg20' ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl bg-white border p-6 shadow-sm">
                <ScaffoldForm onSubmit={handleSubmit} isLoading={isLoading} />
              </div>
              <div className="rounded-xl bg-white border p-6 shadow-sm">
                {error && (
                  <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
                {result ? (
                  <ResultsPanel result={result} />
                ) : !error ? (
                  <div className="flex items-center justify-center h-full min-h-32">
                    <p className="text-sm text-slate-400">Results will appear here after you submit the form.</p>
                  </div>
                ) : null}
              </div>
            </div>
            {result && submittedParams && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="rounded-xl bg-slate-900 border border-slate-700 p-6">
                  <ElevationView params={submittedParams as unknown as ScaffoldParams} />
                </div>
                <div className="rounded-xl bg-white border p-6 shadow-sm">
                  <MtoPanel mto={calculateMto(submittedParams as unknown as ScaffoldParams)} jobRef={result.jobRef} />
                </div>
              </div>
            )}
            <p className="text-xs text-slate-400 text-center">
              TG20 table values are representative — verify against NASC TG20:13 eGuide before production use.
            </p>
          </>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl bg-white border p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold">Scaffold Density — Inputs</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <label>Zone name<input value={densityInput.zone_name} onChange={e => setDensityInput({ ...densityInput, zone_name: e.target.value })} className="w-full mt-1 rounded border px-2 py-1.5" /></label>
                <label>Bay length (m)<input type="number" step="0.1" value={densityInput.bay_length} onChange={e => setDensityInput({ ...densityInput, bay_length: parseFloat(e.target.value) || 0 })} className="w-full mt-1 rounded border px-2 py-1.5" /></label>
                <label>Lift height (m)<input type="number" step="0.1" value={densityInput.lift_height} onChange={e => setDensityInput({ ...densityInput, lift_height: parseFloat(e.target.value) || 0 })} className="w-full mt-1 rounded border px-2 py-1.5" /></label>
                <label>Board length (m)<input type="number" step="0.1" value={densityInput.board_length} onChange={e => setDensityInput({ ...densityInput, board_length: parseFloat(e.target.value) || 0 })} className="w-full mt-1 rounded border px-2 py-1.5" /></label>
                <label>Num bays<input type="number" value={densityInput.num_bays} onChange={e => setDensityInput({ ...densityInput, num_bays: parseInt(e.target.value) || 0 })} className="w-full mt-1 rounded border px-2 py-1.5" /></label>
                <label>Num lifts<input type="number" value={densityInput.num_lifts} onChange={e => setDensityInput({ ...densityInput, num_lifts: parseInt(e.target.value) || 0 })} className="w-full mt-1 rounded border px-2 py-1.5" /></label>
                <label>Boarded lifts<input type="number" value={densityInput.boarded_lifts} onChange={e => setDensityInput({ ...densityInput, boarded_lifts: parseInt(e.target.value) || 0 })} className="w-full mt-1 rounded border px-2 py-1.5" /></label>
                <label>Boards wide<input type="number" value={densityInput.boards_wide} onChange={e => setDensityInput({ ...densityInput, boards_wide: parseInt(e.target.value) || 0 })} className="w-full mt-1 rounded border px-2 py-1.5" /></label>
                <label>Tube
                  <select value={densityInput.tube_idx} onChange={e => setDensityInput({ ...densityInput, tube_idx: parseInt(e.target.value) })} className="w-full mt-1 rounded border px-2 py-1.5">
                    {TUBE_SPECS.map((t, i) => <option key={i} value={i}>{t.label} ({t.kg_m} kg/m)</option>)}
                  </select>
                </label>
                <label>Board
                  <select value={densityInput.board_idx} onChange={e => setDensityInput({ ...densityInput, board_idx: parseInt(e.target.value) })} className="w-full mt-1 rounded border px-2 py-1.5">
                    {BOARD_SPECS.map((b, i) => <option key={i} value={i}>{b.label} ({b.kg_m} kg/m)</option>)}
                  </select>
                </label>
                <label>Scaffold type
                  <select value={densityInput.scaffold_idx} onChange={e => setDensityInput({ ...densityInput, scaffold_idx: parseInt(e.target.value) })} className="w-full mt-1 rounded border px-2 py-1.5">
                    {SCAFFOLD_TYPES.map((s, i) => <option key={i} value={i}>{s}</option>)}
                  </select>
                </label>
                <label>Load class (1-6)<input type="number" min={1} max={6} value={densityInput.load_class} onChange={e => setDensityInput({ ...densityInput, load_class: parseInt(e.target.value) || 1 })} className="w-full mt-1 rounded border px-2 py-1.5" /></label>
              </div>
              <div className="flex gap-4 text-xs">
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={densityInput.include_couplers} onChange={e => setDensityInput({ ...densityInput, include_couplers: e.target.checked })} /> Include couplers</label>
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={densityInput.include_boards} onChange={e => setDensityInput({ ...densityInput, include_boards: e.target.checked })} /> Include boards</label>
              </div>
              <div className="text-xs text-slate-500">
                Envelope: {densityResult.L} × {densityResult.W} × {densityResult.H} m = {densityResult.V} m³ — {densityResult.scaffold_type} · {densityResult.tube_label}
              </div>
            </div>
            <div className="rounded-xl bg-white border p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold">Density Results — {densityResult.zone_name}</h3>
              {!densityResult.bay_ok && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">⚠ Bay length {densityInput.bay_length}m exceeds TG20 max 2.0m</p>}
              {!densityResult.lift_ok && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">⚠ Lift height {densityInput.lift_height}m exceeds TG20 max 2.0m</p>}
              {!densityResult.hbr_ok && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">⚠ H/B ratio {densityResult.hbr} &gt; 3.5 — requires tying/bespoke design</p>}
              {!densityResult.height_ok && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">⚠ Height {densityResult.H}m &gt; 50m — bespoke design required</p>}
              {densityResult.bay_ok && densityResult.lift_ok && densityResult.hbr_ok && densityResult.height_ok && <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded p-2">✓ TG20 compliance: PASS</p>}
              <table className="w-full text-xs border">
                <thead><tr className="bg-slate-50 text-slate-500"><th className="text-left p-1.5">Component</th><th className="text-right p-1.5">Count</th><th className="text-right p-1.5">Mass (kg)</th><th className="text-right p-1.5">kg/m³</th></tr></thead>
                <tbody>
                  {([
                    ['Standards', densityResult.n_standards, densityResult.mass_standards],
                    ['Ledgers', densityResult.n_ledgers, densityResult.mass_ledgers],
                    ['Transoms', densityResult.n_transoms, densityResult.mass_transoms],
                    ['Braces', densityResult.n_braces, densityResult.mass_braces],
                    ['Couplers', densityResult.n_couplers, densityResult.mass_couplers],
                    ['Boards', densityResult.n_boards, densityResult.mass_boards],
                  ] as const).map(([label, cnt, mass]) => (
                    <tr key={label} className="border-t"><td className="p-1.5">{label}</td><td className="p-1.5 text-right">{cnt}</td><td className="p-1.5 text-right">{mass}</td><td className="p-1.5 text-right">{densityResult.V ? (mass / densityResult.V).toFixed(2) : '0.00'}</td></tr>
                  ))}
                  <tr className="border-t bg-slate-50 font-semibold"><td className="p-1.5">TOTAL</td><td className="p-1.5 text-right">{densityResult.total_components}</td><td className="p-1.5 text-right">{densityResult.total_mass}</td><td className="p-1.5 text-right">{densityResult.mat_density}</td></tr>
                </tbody>
              </table>
              <div className="rounded bg-slate-900 text-slate-100 p-3 text-xs space-y-1">
                <div>Material density: <b>{densityResult.mat_density} kg/m³</b></div>
                <div>Component density: <b>{densityResult.comp_density} units/m³</b></div>
                <div>Tie density: <b>{densityResult.tie_density} ties/m³</b> — {densityResult.n_ties} ties @ 4m grid</div>
                <div>Load class {densityResult.load_class}: {densityResult.load_class_udl} kN/m²</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
