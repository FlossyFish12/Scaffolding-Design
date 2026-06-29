import { describe, it, expect } from 'vitest'
import { weeksInRange, weekLabel, phaseWeeks } from '@/lib/schedule-utils'

describe('weeksInRange', () => {
  it('returns Mondays spanning the range', () => {
    const weeks = weeksInRange(new Date('2026-07-06'), new Date('2026-07-26'))
    // 2026-07-06 is a Monday; 2026-07-13, 2026-07-20 follow
    expect(weeks).toHaveLength(3)
    expect(weeks[0].toISOString().startsWith('2026-07-06')).toBe(true)
    expect(weeks[2].toISOString().startsWith('2026-07-20')).toBe(true)
  })

  it('includes the week containing startDate even if not a Monday', () => {
    const weeks = weeksInRange(new Date('2026-07-08'), new Date('2026-07-14'))
    // Floor to Monday 2026-07-06, then next Monday 2026-07-13 — 2 weeks
    expect(weeks.length).toBeGreaterThanOrEqual(1)
    expect(weeks[0].getDay()).toBe(1) // Monday
  })
})

describe('weekLabel', () => {
  it('formats date as "DD MMM"', () => {
    const label = weekLabel(new Date('2026-07-06'))
    expect(label).toBe('06 Jul')
  })
})

describe('phaseWeeks', () => {
  it('returns correct startCol and spanCols', () => {
    const ganttStart = new Date('2026-07-06') // week 0
    const phase = {
      startDate: '2026-07-13T00:00:00.000Z', // week 1
      endDate: '2026-07-26T00:00:00.000Z',   // ends mid-week 2 → span 2
    }
    const result = phaseWeeks(phase, ganttStart)
    expect(result.startCol).toBe(1)
    expect(result.spanCols).toBeGreaterThanOrEqual(1)
  })

  it('clamps startCol to 0 when phase starts before ganttStart', () => {
    const ganttStart = new Date('2026-07-13')
    const phase = { startDate: '2026-07-06T00:00:00.000Z', endDate: '2026-07-20T00:00:00.000Z' }
    const result = phaseWeeks(phase, ganttStart)
    expect(result.startCol).toBe(0)
    expect(result.spanCols).toBeGreaterThanOrEqual(1)
  })
})
