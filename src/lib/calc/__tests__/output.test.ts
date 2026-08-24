import { describe, test, expect } from 'vitest'
import { generateCalcSheet, generateMethodStatement } from '../output'
import { ScaffoldParams, ComplianceResult, StructuralResult } from '../types'

function mockParams(): ScaffoldParams {
  return {
    height_m: 12.0, bay_length_m: 2.1, lift_height_m: 2.0, boards: 4,
    load_class: 2, wind_zone: 2, tie_pattern: 'alternate',
    ground_bearing_kpa: 100.0, job_ref: '20260601-test',
  }
}

function mockCompliance(compliant = true): ComplianceResult {
  return {
    standardConfigFound: true,
    compliant,
    checks: [{ name: 'Maximum height', passed: compliant, actual: 12.0, limit: 20.0, unit: 'm', clause: 'TG20:13 Table B.1' }],
    maxLegLoadKn: 14.2,
  }
}

function mockStructural(passed = true): StructuralResult {
  return {
    passed,
    requiresEngineer: !passed,
    checks: [{ name: 'Leg buckling', passed, actual: 10.0, limit: 50.5, unit: 'kN', clause: 'EN 1993-1-1 §6.3.1' }],
  }
}

describe('output generation', () => {
  test('calc sheet contains job ref', () => {
    const doc = generateCalcSheet(mockParams(), mockCompliance(), null, [])
    expect(doc).toContain('20260601-test')
  })

  test('calc sheet contains COMPLIANT for passing config', () => {
    const doc = generateCalcSheet(mockParams(), mockCompliance(true), null, [])
    expect(doc.toUpperCase()).toContain('COMPLIANT')
  })

  test('calc sheet mentions engineer when structural fails', () => {
    const doc = generateCalcSheet(mockParams(), mockCompliance(false), mockStructural(false), [])
    expect(doc.toLowerCase()).toContain('engineer')
  })

  test('calc sheet contains clause reference', () => {
    const doc = generateCalcSheet(mockParams(), mockCompliance(), null, [])
    expect(doc).toContain('TG20:13')
  })

  test('method statement contains job ref', () => {
    const doc = generateMethodStatement(mockParams(), mockCompliance(), null, [])
    expect(doc).toContain('20260601-test')
  })

  test('method statement contains tie pattern', () => {
    const doc = generateMethodStatement(mockParams(), mockCompliance(), null, [])
    expect(doc.toLowerCase()).toContain('alternate')
  })

  test('method statement contains inspection section', () => {
    const doc = generateMethodStatement(mockParams(), mockCompliance(), null, [])
    expect(doc).toMatch(/nspection/i)
  })
})
