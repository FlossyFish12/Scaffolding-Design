import { describe, test, expect } from 'vitest'
import { runCalc } from '../index'

const BASE = {
  height_m: 12.0, bay_length_m: 2.1, lift_height_m: 2.0,
  boards: 4, load_class: 2, wind_zone: 2, tie_pattern: 'alternate',
  ground_bearing_kpa: 100.0,
}

describe('runCalc integration', () => {
  test('compliant config returns verdict compliant with documents', () => {
    const result = runCalc(BASE)
    expect(result.verdict).toBe('compliant')
    expect(result.calcSheet).toBeTruthy()
    expect(result.methodStatement).toBeTruthy()
  })

  test('calc sheet contains job ref', () => {
    const result = runCalc({ ...BASE, job_ref: '20260601-test' })
    expect(result.calcSheet).toContain('20260601-test')
  })

  test('method statement contains inspection section', () => {
    const result = runCalc(BASE)
    expect(result.methodStatement).toMatch(/nspection/i)
  })

  test('height over tg20 limit returns non-compliant or requires_engineer', () => {
    const result = runCalc({ ...BASE, height_m: 25.0 })
    expect(result.verdict).not.toBe('compliant')
  })

  test('missing required field throws validation error', () => {
    expect(() => runCalc({ height_m: 12.0 })).toThrow()
  })
})
