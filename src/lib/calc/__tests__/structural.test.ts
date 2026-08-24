import { describe, test, expect } from 'vitest'
import { checkStructural } from '../structural'
import { TubeProps } from '../types'

// Use large bearing_area_mm2 to isolate buckling tests from ground bearing failures
const PROPS: TubeProps = {
  tube: {
    area_mm2: 454, iy_mm: 16.4, fy_mpa: 235, E_mpa: 210000,
    imperfection_factor: 0.21, gamma_M1: 1.0,
  },
  base_plate: { bearing_area_mm2: 250000 },
}

describe('structural checks', () => {
  test('light load passes all checks', () => {
    const result = checkStructural(2.0, 10.0, 10.0, 100.0, PROPS)
    expect(result.passed).toBe(true)
    expect(result.requiresEngineer).toBe(false)
  })

  test('overloaded leg fails buckling', () => {
    // 60 kN exceeds ~50.3 kN buckling capacity for 2m lift
    const result = checkStructural(2.0, 60.0, 60.0, 100.0, PROPS)
    expect(result.passed).toBe(false)
    const failed = result.checks.filter(c => !c.passed)
    expect(failed.some(c => c.name.toLowerCase().includes('buckling'))).toBe(true)
  })

  test('failed structural check sets requiresEngineer', () => {
    const result = checkStructural(2.0, 60.0, 60.0, 100.0, PROPS)
    expect(result.requiresEngineer).toBe(true)
  })

  test('poor ground bearing fails bearing check', () => {
    // 40 kN / 0.25 m² = 160 kPa >> 1 kPa limit
    const result = checkStructural(2.0, 40.0, 40.0, 1.0, PROPS)
    const failed = result.checks.filter(c => !c.passed)
    expect(failed.some(c => c.name.toLowerCase().includes('bearing'))).toBe(true)
  })

  test('shorter lift increases buckling capacity', () => {
    // 52 kN: fails at 2m lift (~50.3 kN capacity), passes at 1m lift (~92.9 kN capacity)
    const result2m = checkStructural(2.0, 52.0, 52.0, 250.0, PROPS)
    const result1m = checkStructural(1.0, 52.0, 52.0, 250.0, PROPS)
    expect(result2m.passed).toBe(false)
    expect(result1m.passed).toBe(true)
  })

  test('each check has clause reference', () => {
    const result = checkStructural(2.0, 10.0, 10.0, 100.0, PROPS)
    for (const c of result.checks) {
      expect(c.clause, `Check '${c.name}' missing clause`).toBeTruthy()
    }
  })
})
