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
