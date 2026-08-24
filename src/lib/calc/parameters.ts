import { z } from 'zod'
import { ScaffoldParams, ValidationResult } from './types'

const schema = z.object({
  height_m: z.number().positive(),
  bay_length_m: z.number().positive(),
  lift_height_m: z.number()
    .min(1.5, 'Lift height must be between 1.5 and 2.7 m')
    .max(2.7, 'Lift height must be between 1.5 and 2.7 m')
    .default(2.0),
  boards: z.number().int()
    .min(3, 'boards must be 3, 4, or 5')
    .max(5, 'boards must be 3, 4, or 5'),
  num_bays: z.number().int().min(1, 'Must be at least 1 bay').default(10),
  load_class: z.number().int()
    .min(1, 'Load class must be 1–6')
    .max(6, 'Load class must be 1–6'),
  wind_zone: z.number().int()
    .min(1, 'Wind zone must be 1–4')
    .max(4, 'Wind zone must be 1–4'),
  tie_pattern: z.enum(['alternate', 'every_lift', 'every_bay']),
  ground_bearing_kpa: z.number().positive().default(50),
  job_ref: z.string().optional(),
}).passthrough()

const STANDARD_BAYS = [1.8, 2.1, 2.4]

export function validate(data: Record<string, unknown>): ValidationResult {
  const result = schema.safeParse(data)

  if (!result.success) {
    const errors = result.error.issues.map(
      issue => `${issue.path.join('.') || 'input'}: ${issue.message}`
    )
    return { params: null, errors, warnings: [] }
  }

  const d = result.data
  const warnings: string[] = []

  if (d.height_m > 30) {
    warnings.push('Height > 30m: independent designer review required (TG20:13 §3.2)')
  }
  if (!STANDARD_BAYS.some(b => Math.abs(b - d.bay_length_m) <= 0.05)) {
    warnings.push(
      `Bay length ${d.bay_length_m}m is non-standard — TG20 table lookup may not find a matching configuration`
    )
  }

  const params: ScaffoldParams = {
    height_m: d.height_m,
    bay_length_m: d.bay_length_m,
    lift_height_m: d.lift_height_m,
    boards: d.boards,
    num_bays: d.num_bays,
    load_class: d.load_class,
    wind_zone: d.wind_zone,
    tie_pattern: d.tie_pattern as ScaffoldParams['tie_pattern'],
    ground_bearing_kpa: d.ground_bearing_kpa,
    job_ref: d.job_ref ?? new Date().toISOString().slice(0, 10),
  }

  return { params, errors: [], warnings }
}
