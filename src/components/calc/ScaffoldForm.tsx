'use client'
import { useState, useEffect } from 'react'

interface FormState {
  job_ref: string
  height_m: string
  bay_length_m: string
  lift_height_m: string
  boards: string
  num_bays: string
  load_class: string
  wind_zone: string
  tie_pattern: string
  ground_bearing_kpa: string
}

interface ScaffoldFormProps {
  onSubmit: (params: Record<string, unknown>) => void
  isLoading: boolean
}

const REQUIRED_FIELDS: (keyof FormState)[] = [
  'height_m', 'bay_length_m', 'boards', 'num_bays', 'load_class', 'wind_zone', 'tie_pattern',
]

const INITIAL_STATE: FormState = {
  job_ref: '', height_m: '', bay_length_m: '', lift_height_m: '2.0',
  boards: '', num_bays: '10', load_class: '', wind_zone: '', tie_pattern: 'alternate',
  ground_bearing_kpa: '50',
}

const HELP_TEXT: Record<keyof FormState, string> = {
  job_ref: 'Optional reference for your records',
  height_m: 'Overall scaffold height from ground to top lift',
  bay_length_m: 'Standard bays: 1.8 m, 2.1 m, or 2.4 m',
  lift_height_m: 'Height between successive working platforms (1.5–2.7 m)',
  boards: 'Number of boards wide (3 = light access, 5 = full-width working platform)',
  num_bays: 'Total number of scaffold bays along the structure',
  load_class: 'TG20 load class 1–6 (class 2 = 1.5 kN/m², class 3 = 2.0 kN/m²)',
  wind_zone: 'UK wind zone 1–4 (1 = sheltered, 4 = severe exposed)',
  tie_pattern: 'How frequently the scaffold is tied back to the structure',
  ground_bearing_kpa: 'Bearing capacity of ground under base plates (default 50 kPa)',
}

const PRESETS: { label: string; values: Partial<FormState> }[] = [
  {
    label: 'Typical 10m',
    values: {
      height_m: '10', bay_length_m: '2.1', lift_height_m: '2.0', boards: '4', num_bays: '10',
      load_class: '2', wind_zone: '2', tie_pattern: 'alternate', ground_bearing_kpa: '50',
    },
  },
  {
    label: 'Medium 20m',
    values: {
      height_m: '20', bay_length_m: '2.1', lift_height_m: '2.0', boards: '4', num_bays: '10',
      load_class: '3', wind_zone: '2', tie_pattern: 'alternate', ground_bearing_kpa: '50',
    },
  },
  {
    label: 'Heavy 25m',
    values: {
      height_m: '25', bay_length_m: '2.4', lift_height_m: '2.0', boards: '5', num_bays: '10',
      load_class: '4', wind_zone: '3', tie_pattern: 'every_lift', ground_bearing_kpa: '100',
    },
  },
]

export function ScaffoldForm({ onSubmit, isLoading }: ScaffoldFormProps) {
  const [form, setForm] = useState<FormState>(INITIAL_STATE)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({})

  // Restore saved form values from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('scaffold-form')
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<FormState>
        setForm(prev => ({ ...prev, ...parsed }))
      }
    } catch {
      // ignore parse errors
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    const next = { ...form, [name]: value }
    setForm(next)
    localStorage.setItem('scaffold-form', JSON.stringify(next))
    if (fieldErrors[name as keyof FormState]) {
      setFieldErrors(prev => ({ ...prev, [name]: undefined }))
    }
  }

  function handlePreset(values: Partial<FormState>) {
    const next = { ...INITIAL_STATE, ...values }
    setForm(next)
    setFieldErrors({})
    localStorage.setItem('scaffold-form', JSON.stringify(next))
  }

  function handleReset() {
    setForm(INITIAL_STATE)
    setFieldErrors({})
    localStorage.removeItem('scaffold-form')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errors: Partial<Record<keyof FormState, string>> = {}
    for (const f of REQUIRED_FIELDS) {
      if (!form[f]) errors[f] = 'Required'
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    onSubmit({
      job_ref: form.job_ref || undefined,
      height_m: parseFloat(form.height_m),
      bay_length_m: parseFloat(form.bay_length_m),
      lift_height_m: parseFloat(form.lift_height_m),
      boards: parseInt(form.boards),
      num_bays: parseInt(form.num_bays),
      load_class: parseInt(form.load_class),
      wind_zone: parseInt(form.wind_zone),
      tie_pattern: form.tie_pattern,
      ground_bearing_kpa: parseFloat(form.ground_bearing_kpa),
    })
  }

  function field(
    name: keyof FormState,
    label: string,
    placeholder: string,
    type: 'text' | 'number' = 'number',
  ) {
    const error = fieldErrors[name]
    return (
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-0.5">{label}</label>
        <p className="text-xs text-slate-500 mb-1">{HELP_TEXT[name]}</p>
        <input
          type={type}
          name={name}
          value={form[name]}
          onChange={handleChange}
          placeholder={placeholder}
          step="any"
          className={`w-full rounded bg-slate-800 border px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
            error ? 'border-red-500' : 'border-slate-600'
          }`}
        />
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Job</p>

        {/* Preset examples */}
        <p className="text-xs text-slate-500 mb-1">Load example:</p>
        <div className="flex gap-2 mb-4">
          {PRESETS.map(preset => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handlePreset(preset.values)}
              className="rounded bg-slate-700 px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-600 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {field('job_ref', 'Job Reference (optional)', 'e.g. SITE-001', 'text')}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Geometry</p>
        <div className="grid grid-cols-2 gap-3">
          {field('height_m', 'Height (m)', 'e.g. 12.0')}
          {field('bay_length_m', 'Bay length (m)', 'e.g. 2.1')}
          {field('lift_height_m', 'Lift height (m)', 'default 2.0')}
          {field('boards', 'Boards (3–5)', 'e.g. 4')}
          {field('num_bays', 'Number of bays', 'e.g. 10')}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Loads & Exposure</p>
        <div className="grid grid-cols-2 gap-3">
          {field('load_class', 'Load class (1–6)', 'e.g. 2')}
          {field('wind_zone', 'Wind zone (1–4)', 'e.g. 2')}
          {field('ground_bearing_kpa', 'Ground bearing (kPa)', 'default 50')}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-0.5">Tie pattern</label>
            <p className="text-xs text-slate-500 mb-1">{HELP_TEXT.tie_pattern}</p>
            <select
              name="tie_pattern"
              value={form.tie_pattern}
              onChange={handleChange}
              className="w-full rounded bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="alternate">Alternate</option>
              <option value="every_lift">Every lift</option>
              <option value="every_bay">Every bay</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 rounded bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Running…' : 'Run Calculations →'}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Clear
        </button>
      </div>
    </form>
  )
}
