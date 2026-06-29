import { describe, it, expect } from 'vitest'
import { evaluateFormula, generateEstimateItems } from '../estimate-engine'
import type { ZoneDimensions, TemplateLineItemInput } from '../estimate-engine'

const zone: ZoneDimensions = { heightM: 4, perimeterM: 20, areaM2: 25 }

describe('evaluateFormula', () => {
  it('evaluates area_m2 variable', () => {
    expect(evaluateFormula('area_m2', zone)).toBe(25)
  })

  it('evaluates perimeter_m variable', () => {
    expect(evaluateFormula('perimeter_m', zone)).toBe(20)
  })

  it('evaluates height_m variable', () => {
    expect(evaluateFormula('height_m', zone)).toBe(4)
  })

  it('evaluates combined formula with *', () => {
    expect(evaluateFormula('area_m2 * height_m * 0.15', zone)).toBeCloseTo(15)
  })

  it('evaluates formula with × unicode operator', () => {
    expect(evaluateFormula('area_m2 × height_m × 0.15', zone)).toBeCloseTo(15)
  })

  it('evaluates formula with parentheses', () => {
    expect(evaluateFormula('(perimeter_m + area_m2) * height_m', zone)).toBe(180)
  })

  it('throws on formula with unexpected characters', () => {
    expect(() => evaluateFormula('require("fs")', zone)).toThrow()
  })

  it('throws when result is non-finite', () => {
    expect(() => evaluateFormula('area_m2 / 0', zone)).toThrow()
  })
})

describe('generateEstimateItems', () => {
  const lineItems: TemplateLineItemInput[] = [
    { category: 'labour', description: 'Erect & dismantle', formula: 'area_m2 * height_m * 0.15', unit: 'hrs' },
    { category: 'material', description: 'Tube & coupler', formula: 'perimeter_m * height_m * 1.5', unit: 'm' },
  ]

  it('generates correct quantities', () => {
    const items = generateEstimateItems(lineItems, zone)
    expect(items[0].quantity).toBeCloseTo(15)
    expect(items[1].quantity).toBeCloseTo(120)
  })

  it('sets unitManhours 1.0 for labour, 0 for material', () => {
    const items = generateEstimateItems(lineItems, zone)
    expect(items[0].unitManhours).toBe(1.0)
    expect(items[1].unitManhours).toBe(0)
  })

  it('preserves category, description, unit from template', () => {
    const items = generateEstimateItems(lineItems, zone)
    expect(items[0].category).toBe('labour')
    expect(items[0].description).toBe('Erect & dismantle')
    expect(items[0].unit).toBe('hrs')
  })

  it('rounds quantity to 2 decimal places', () => {
    const items = generateEstimateItems(
      [{ category: 'labour', description: 'x', formula: 'area_m2 * 0.333', unit: 'hrs' }],
      zone,
    )
    const str = String(items[0].quantity)
    const decimals = str.includes('.') ? str.split('.')[1].length : 0
    expect(decimals).toBeLessThanOrEqual(2)
  })
})
