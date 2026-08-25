'use client'
import { useEffect, useRef, useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { suggestScaffoldType } from '@/lib/scaffold-rules'
import { runCalc } from '@/lib/calc'
import { calculateDensity, TUBE_SPECS, BOARD_SPECS } from '@/lib/calc/density'
import { calculateMto } from '@/lib/calc/mto'
import dynamic from 'next/dynamic'

const Scaffold3DPreview = dynamic(() => import('@/components/preview/scaffold-3d-preview'), { ssr: false })
const SafetyChecklist = dynamic(() => import('@/components/safety/checklist'), { ssr: false })

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
  zoneId?: string
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
  zoneId,
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
  const [showEngineering, setShowEngineering] = useState(false)

  // Engineering preview inputs (not persisted to Zone, used for live calc)
  const [bayLengthM, setBayLengthM] = useState(2.1)
  const [liftHeightM, setLiftHeightM] = useState(2.0)
  const [boardsWide, setBoardsWide] = useState(4)
  const [windZone, setWindZone] = useState(2)
  const [tiePattern, setTiePattern] = useState<'alternate' | 'every_lift' | 'every_bay'>('alternate')
  const [groundBearingKpa, setGroundBearingKpa] = useState(50)
  const [tubeIdx, setTubeIdx] = useState(0)
  const [boardIdx, setBoardIdx] = useState(0)

  const accessType = watch('accessType')
  const loadingClass = watch('loadingClass')
  const templateId = watch('templateId')
  const heightM = watch('heightM')
  const perimeterM = watch('perimeterM')
  const areaM2 = watch('areaM2')
  const scaffoldType = watch('scaffoldType')
  const label = watch('label')

  // Auto-suggest scaffold type when access type or loading class changes.
  // Skip the initial render so we don't overwrite the stored value in edit mode.
  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return }
    setValue('scaffoldType', suggestScaffoldType(accessType, loadingClass), { shouldDirty: true })
  }, [accessType, loadingClass, setValue])

  // Derive num_bays from perimeter if available, else default
  const derivedNumBays = useMemo(() => {
    if (perimeterM > 0 && bayLengthM > 0) {
      const est = Math.round(perimeterM / bayLengthM)
      return Math.max(1, Math.min(20, est || 5))
    }
    return 5
  }, [perimeterM, bayLengthM])

  const loadClassMap: Record<string, number> = { light: 2, medium: 3, heavy: 4 }
  const tg20LoadClass = loadClassMap[loadingClass] ?? 2

  const scaffoldIdxMap: Record<string, number> = { independent: 0, putlog: 1, birdcage: 2, suspended: 0, cantilever: 0 }

  // Live TG20 calc
  const tg20Result = useMemo(() => {
    if (!heightM || heightM <= 0) return null
    try {
      return runCalc({
        height_m: heightM,
        bay_length_m: bayLengthM,
        lift_height_m: liftHeightM,
        boards: boardsWide,
        num_bays: derivedNumBays,
        load_class: tg20LoadClass,
        wind_zone: windZone,
        tie_pattern: tiePattern,
        ground_bearing_kpa: groundBearingKpa,
        job_ref: label || 'ZONE-PREVIEW',
      })
    } catch {
      return null
    }
  }, [heightM, bayLengthM, liftHeightM, boardsWide, derivedNumBays, tg20LoadClass, windZone, tiePattern, groundBearingKpa, label])

  // Live density calc
  const densityResult = useMemo(() => {
    if (!heightM || heightM <= 0 || !bayLengthM) return null
    const numLifts = Math.max(1, Math.ceil(heightM / liftHeightM))
    const boardedLifts = Math.max(1, Math.ceil(numLifts * 0.5))
    try {
      return calculateDensity({
        zone_name: label || 'Zone',
        bay_length: bayLengthM,
        lift_height: liftHeightM,
        num_bays: derivedNumBays,
        num_lifts: numLifts,
        boarded_lifts: boardedLifts,
        boards_wide: boardsWide,
        board_length: 2.4,
        tube_idx: tubeIdx,
        board_idx: boardIdx,
        scaffold_idx: scaffoldIdxMap[scaffoldType] ?? 0,
        load_class: tg20LoadClass,
        include_couplers: true,
        include_boards: true,
      })
    } catch {
      return null
    }
  }, [heightM, bayLengthM, liftHeightM, derivedNumBays, boardsWide, tubeIdx, boardIdx, scaffoldType, tg20LoadClass, label])

  // MTO preview (uses same derived params)
  const mtoResult = useMemo(() => {
    if (!heightM || heightM <= 0) return null
    try {
      return calculateMto({
        height_m: heightM,
        bay_length_m: bayLengthM,
        lift_height_m: liftHeightM,
        boards: boardsWide,
        num_bays: derivedNumBays,
        load_class: tg20LoadClass,
        wind_zone: windZone,
        tie_pattern: tiePattern,
        ground_bearing_kpa: groundBearingKpa,
        job_ref: label || 'ZONE-PREVIEW',
      })
    } catch {
      return null
    }
  }, [heightM, bayLengthM, liftHeightM, boardsWide, derivedNumBays, tg20LoadClass, windZone, tiePattern, groundBearingKpa, label])

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
      className="w-80 flex-shrink-0 flex flex-col border-l border-[var(--border)] bg-[var(--card)] overflow-y-auto"
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

        {/* Engineering Preview Toggle */}
        <div className="border rounded-md bg-muted/20">
          <button
            type="button"
            onClick={() => setShowEngineering(!showEngineering)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            <span>Engineering Preview</span>
            <span className="text-sm">{showEngineering ? '−' : '+'}</span>
          </button>
          {showEngineering && (
            <div className="px-3 pb-3 space-y-3 border-t pt-3">
              {/* Calc inputs */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={LABEL_CLASS}>Bay (m)</label>
                  <input type="number" step="0.1" value={bayLengthM} onChange={e => setBayLengthM(parseFloat(e.target.value) || 0)} className={FIELD_CLASS} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Lift (m)</label>
                  <input type="number" step="0.1" value={liftHeightM} onChange={e => setLiftHeightM(parseFloat(e.target.value) || 0)} className={FIELD_CLASS} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Boards</label>
                  <select value={boardsWide} onChange={e => setBoardsWide(parseInt(e.target.value))} className={FIELD_CLASS}>
                    <option value={3}>3</option><option value={4}>4</option><option value={5}>5</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Wind zone</label>
                  <select value={windZone} onChange={e => setWindZone(parseInt(e.target.value))} className={FIELD_CLASS}>
                    <option value={1}>1 Inland sheltered</option><option value={2}>2 Urban/industrial</option><option value={3}>3 Coastal yard</option><option value={4}>4 Marine/elevated</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Tie pattern</label>
                  <select value={tiePattern} onChange={e => setTiePattern(e.target.value as any)} className={FIELD_CLASS}>
                    <option value="alternate">Alternate</option><option value="every_lift">Every lift</option><option value="every_bay">Every bay</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Ground (kPa)</label>
                  <input type="number" value={groundBearingKpa} onChange={e => setGroundBearingKpa(parseFloat(e.target.value) || 50)} className={FIELD_CLASS} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Tube</label>
                  <select value={tubeIdx} onChange={e => setTubeIdx(parseInt(e.target.value))} className={FIELD_CLASS}>
                    {TUBE_SPECS.map((t, i) => <option key={i} value={i}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Board</label>
                  <select value={boardIdx} onChange={e => setBoardIdx(parseInt(e.target.value))} className={FIELD_CLASS}>
                    {BOARD_SPECS.map((b, i) => <option key={i} value={i}>{b.label}</option>)}
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Derived: {derivedNumBays} bays from perimeter {perimeterM}m / {bayLengthM}m · {Math.ceil((heightM||0)/liftHeightM)} lifts</p>

              {/* TG20 */}
              {tg20Result ? (
                <div className={`rounded p-2 text-xs border ${tg20Result.verdict === 'compliant' ? 'bg-green-50 border-green-200 text-green-800' : tg20Result.verdict === 'requires_engineer' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                  <div className="font-semibold">{tg20Result.verdict === 'compliant' ? '✓ COMPLIANT' : tg20Result.verdict === 'requires_engineer' ? '✗ REQUIRES ENGINEER' : '⚠ NON-COMPLIANT'} — TG20 {tg20Result.tg20Compliant ? 'pass' : 'fail'}</div>
                  <div className="mt-1 space-y-0.5">
                    {tg20Result.checks.map((c,i) => <div key={i} className="flex justify-between"><span>{c.name}</span><span className={c.passed?'text-green-700':'text-red-700'}>{c.actual}/{c.limit}{c.unit} {c.passed?'✓':'✗'}</span></div>)}
                    {tg20Result.warnings.map((w,i) => <div key={`w-${i}`} className="text-amber-700">• {w}</div>)}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground border rounded p-2">Enter Height to see TG20 check</div>
              )}

              {/* Density */}
              {densityResult && (
                <div className="rounded border bg-card p-2 text-xs space-y-1">
                  <div className="font-semibold">Density — {densityResult.V}m³ · {densityResult.total_mass}kg · {densityResult.mat_density}kg/m³</div>
                  <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                    <span>Standards {densityResult.n_standards} ({densityResult.mass_standards}kg)</span>
                    <span>Ledgers {densityResult.n_ledgers} ({densityResult.mass_ledgers}kg)</span>
                    <span>Transoms {densityResult.n_transoms} ({densityResult.mass_transoms}kg)</span>
                    <span>Ties {densityResult.n_ties} ({densityResult.tie_density}/m³)</span>
                  </div>
                  {!densityResult.bay_ok && <div className="text-amber-700">⚠ Bay &gt;2.0m</div>}
                  {!densityResult.lift_ok && <div className="text-amber-700">⚠ Lift &gt;2.0m</div>}
                  {!densityResult.hbr_ok && <div className="text-red-700">⚠ H/B {densityResult.hbr} &gt;3.5 — tie/bespoke required</div>}
                  {densityResult.bay_ok && densityResult.lift_ok && densityResult.hbr_ok && densityResult.height_ok && <div className="text-green-700">✓ TG20 geometry pass</div>}
                </div>
              )}

              {/* MTO preview */}
              {mtoResult && (
                <div className="rounded border bg-card p-2 text-xs">
                  <div className="font-semibold mb-1">MTO — {mtoResult.items.length} items</div>
                  <div className="max-h-28 overflow-auto space-y-0.5">
                    {mtoResult.items.slice(0,5).map(it => <div key={it.item} className="flex justify-between"><span>{it.item}</span><span>{it.qty} {it.unit}</span></div>)}
                    {mtoResult.items.length>5 && <div className="text-muted-foreground">+ {mtoResult.items.length-5} more — see /calc for full</div>}
                  </div>
                </div>
              )}

              {/* 3D Preview */}
              {heightM > 0 && (
                <div className="rounded border bg-card p-2">
                  <Scaffold3DPreview
                    heightM={heightM}
                    bayLengthM={bayLengthM}
                    numBays={derivedNumBays}
                    boardsWide={boardsWide}
                    liftHeightM={liftHeightM}
                    scaffoldType={scaffoldType}
                  />
                </div>
              )}

              {/* Per-zone Safety (edit mode only) */}
              {mode === 'edit' && (
                <div className="rounded border bg-card p-2">
                  <p className="text-xs font-semibold mb-2">Safety — {label || 'Zone'}</p>
                  <SafetyChecklist zoneId={zoneId || 'zone-preview'} title="Zone Checklist" />
                </div>
              )}
            </div>
          )}
        </div>

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
            {tg20Result && !tg20Result.tg20Compliant && (
              <p className="text-xs mt-1 text-amber-700">⚠ TG20 fail — estimate will need engineer sign-off</p>
            )}
          </div>
        )}
      </form>
    </aside>
  )
}
