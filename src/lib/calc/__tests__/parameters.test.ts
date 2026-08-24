import { describe, test, expect } from 'vitest'
import { validate } from '../parameters'
import { ScaffoldParams } from '../types'

const BASE: Record<string, unknown> = {
  height_m: 12.0, bay_length_m: 2.1, lift_height_m: 2.0,
  boards: 4, load_class: 2, wind_zone: 2, tie_pattern: 'alternate',
  ground_bearing_kpa: 100.0, job_ref: '20260601-test',
}

function p(overrides: Record<string, unknown>) {
  return { ...BASE, ...overrides }
}

describe('validate', () => {
  test('valid params returns ScaffoldParams with no errors', () => {
    const { params, errors } = validate(BASE)
    expect(errors).toEqual([])
    expect(params).not.toBeNull()
    expect((params as ScaffoldParams).height_m).toBe(12.0)
  })

  test('height over 30m gives warning', () => {
    const { params, errors, warnings } = validate(p({ height_m: 35.0 }))
    expect(errors).toEqual([])
    expect(params?.height_m).toBe(35.0)
    expect(warnings.some(w => w.includes('30'))).toBe(true)
  })

  test('invalid load class gives error', () => {
    const { params, errors } = validate(p({ load_class: 7 }))
    expect(params).toBeNull()
    expect(errors.some(e => e.toLowerCase().includes('load class'))).toBe(true)
  })

  test('invalid wind zone gives error', () => {
    const { params, errors } = validate(p({ wind_zone: 5 }))
    expect(params).toBeNull()
    expect(errors.some(e => e.toLowerCase().includes('wind zone'))).toBe(true)
  })

  test('invalid boards gives error', () => {
    const { params, errors } = validate(p({ boards: 6 }))
    expect(params).toBeNull()
    expect(errors.some(e => e.toLowerCase().includes('board'))).toBe(true)
  })

  test('non-standard bay length gives warning', () => {
    const { params, errors, warnings } = validate(p({ bay_length_m: 3.0 }))
    expect(errors).toEqual([])
    expect(params).not.toBeNull()
    expect(warnings.some(w => w.toLowerCase().includes('bay length') || w.toLowerCase().includes('non-standard'))).toBe(true)
  })

  test('missing required field gives error containing field name', () => {
    const input = Object.fromEntries(Object.entries(BASE).filter(([k]) => k !== 'height_m'))
    const { params, errors } = validate(input)
    expect(params).toBeNull()
    expect(errors.some(e => e.includes('height_m'))).toBe(true)
  })

  test('lift height out of range gives error', () => {
    const { params, errors } = validate(p({ lift_height_m: 3.5 }))
    expect(params).toBeNull()
    expect(errors.some(e => e.toLowerCase().includes('lift height'))).toBe(true)
  })
})
