import { describe, test, expect } from 'vitest'
import { calculateDensity } from '../density'

describe('calculateDensity', () => {
  const base = {
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
  }

  test('computes total mass and volume', () => {
    const r = calculateDensity(base)
    expect(r.V).toBeCloseTo(135, 1)
    expect(r.total_mass).toBeGreaterThan(1000)
    expect(r.n_standards).toBe(12)
  })

  test('HBR warning for tall narrow scaffold', () => {
    const r = calculateDensity(base)
    expect(r.hbr).toBeGreaterThan(3.5)
    expect(r.hbr_ok).toBe(false)
  })

  test('bay/lift compliance flags', () => {
    const r = calculateDensity({ ...base, bay_length: 2.5, lift_height: 2.5 })
    expect(r.bay_ok).toBe(false)
    expect(r.lift_ok).toBe(false)
  })

  test('include flags affect totals', () => {
    const withBoth = calculateDensity(base)
    const without = calculateDensity({ ...base, include_couplers: false, include_boards: false })
    expect(without.total_mass).toBeLessThan(withBoth.total_mass)
    expect(without.total_components).toBeLessThan(withBoth.total_components)
  })

  test('different scaffold types change standards count', () => {
    const ind = calculateDensity({ ...base, scaffold_idx: 0 })
    const put = calculateDensity({ ...base, scaffold_idx: 1 })
    expect(put.n_standards).toBeLessThan(ind.n_standards)
  })
})
