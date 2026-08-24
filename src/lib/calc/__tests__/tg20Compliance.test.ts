import { describe, test, expect } from 'vitest'
import { check } from '../tg20Compliance'
import { ScaffoldParams, Tg20Tables } from '../types'

const TEST_TABLES: Tg20Tables = {
  standard_configurations: [{
    bay_length_m: 2.1, lift_height_m: 2.0, boards: 4, load_class: 2,
    wind_zone: 2, tie_pattern: 'alternate', max_height_m: 20.0,
    max_leg_load_kn: 14.2, tg20_ref: 'Table B.1',
  }],
  load_class_height_factors: { '1': 1.1, '2': 1.0, '3': 0.9, '4': 0.75, '5': 0.6, '6': 0.5 },
}

function params(overrides: Partial<ScaffoldParams> = {}): ScaffoldParams {
  return {
    height_m: 12.0, bay_length_m: 2.1, lift_height_m: 2.0, boards: 4,
    load_class: 2, wind_zone: 2, tie_pattern: 'alternate',
    ground_bearing_kpa: 100.0, job_ref: 'test',
    ...overrides,
  }
}

describe('tg20 compliance check', () => {
  test('standard config found and compliant', () => {
    const result = check(params(), TEST_TABLES)
    expect(result.standardConfigFound).toBe(true)
    expect(result.compliant).toBe(true)
  })

  test('height over limit fails', () => {
    const result = check(params({ height_m: 22.0 }), TEST_TABLES)
    expect(result.standardConfigFound).toBe(true)
    expect(result.compliant).toBe(false)
    const failed = result.checks.filter(c => !c.passed)
    expect(failed.some(c => c.name.toLowerCase().includes('height'))).toBe(true)
  })

  test('height at limit passes', () => {
    const result = check(params({ height_m: 20.0 }), TEST_TABLES)
    expect(result.compliant).toBe(true)
  })

  test('no matching config returns not found', () => {
    const result = check(params({ wind_zone: 4 }), TEST_TABLES)
    expect(result.standardConfigFound).toBe(false)
    expect(result.compliant).toBe(false)
  })

  test('higher load class reduces max height', () => {
    // load class 4: factor 0.75 → adjusted max = 20 * 0.75 = 15m; height 16m > 15m → fail
    const result = check(params({ height_m: 16.0, load_class: 4 }), TEST_TABLES)
    expect(result.compliant).toBe(false)
  })

  test('each check has clause reference', () => {
    const result = check(params(), TEST_TABLES)
    for (const c of result.checks) {
      expect(c.clause, `Check '${c.name}' missing clause`).toBeTruthy()
    }
  })

  test('max leg load returned for standard config', () => {
    const result = check(params(), TEST_TABLES)
    expect(result.maxLegLoadKn).toBe(14.2)
  })
})
