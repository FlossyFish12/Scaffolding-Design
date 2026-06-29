import { describe, it, expect } from 'vitest'
import { suggestScaffoldType } from '../scaffold-rules'

describe('suggestScaffoldType', () => {
  it('ground + light → independent', () => {
    expect(suggestScaffoldType('ground', 'light')).toBe('independent')
  })
  it('ground + medium → independent', () => {
    expect(suggestScaffoldType('ground', 'medium')).toBe('independent')
  })
  it('ground + heavy → birdcage', () => {
    expect(suggestScaffoldType('ground', 'heavy')).toBe('birdcage')
  })
  it('elevated + light → cantilever', () => {
    expect(suggestScaffoldType('elevated', 'light')).toBe('cantilever')
  })
  it('elevated + heavy → cantilever', () => {
    expect(suggestScaffoldType('elevated', 'heavy')).toBe('cantilever')
  })
  it('overhead + any → suspended', () => {
    expect(suggestScaffoldType('overhead', 'medium')).toBe('suspended')
  })
  it('confined + any → birdcage', () => {
    expect(suggestScaffoldType('confined', 'light')).toBe('birdcage')
  })
})
