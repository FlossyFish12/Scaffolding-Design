export interface ScaffoldParams {
  height_m: number
  bay_length_m: number
  lift_height_m: number
  boards: number
  num_bays: number
  load_class: number
  wind_zone: number
  tie_pattern: 'alternate' | 'every_lift' | 'every_bay'
  ground_bearing_kpa: number
  job_ref: string
}

export interface ValidationResult {
  params: ScaffoldParams | null
  errors: string[]
  warnings: string[]
}

export interface ComplianceCheck {
  name: string
  passed: boolean
  actual: number
  limit: number
  unit: string
  clause: string
}

export interface ComplianceResult {
  standardConfigFound: boolean
  compliant: boolean
  checks: ComplianceCheck[]
  maxLegLoadKn: number | null
}

export interface StructuralCheck {
  name: string
  passed: boolean
  actual: number
  limit: number
  unit: string
  clause: string
}

export interface StructuralResult {
  passed: boolean
  requiresEngineer: boolean
  checks: StructuralCheck[]
}

export interface CalcCheck {
  name: string
  passed: boolean
  actual: number
  limit: number
  unit: string
  clause: string
}

export interface CalcResult {
  jobRef: string
  verdict: 'compliant' | 'non_compliant' | 'requires_engineer'
  tg20Compliant: boolean
  requiresEngineer: boolean
  warnings: string[]
  checks: CalcCheck[]
  calcSheet: string
  methodStatement: string
}

export interface Tg20Tables {
  standard_configurations: Array<{
    bay_length_m: number
    lift_height_m: number
    boards: number
    load_class: number
    wind_zone: number
    tie_pattern: string
    max_height_m: number
    max_leg_load_kn: number
    tg20_ref: string
  }>
  load_class_height_factors: Record<string, number>
}

export interface TubeProps {
  tube: {
    area_mm2: number
    iy_mm: number
    fy_mpa: number
    E_mpa: number
    imperfection_factor: number
    gamma_M1: number
  }
  base_plate: {
    bearing_area_mm2: number
  }
}
