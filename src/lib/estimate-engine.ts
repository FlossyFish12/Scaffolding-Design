export type ZoneDimensions = {
  heightM: number
  perimeterM: number
  areaM2: number
}

export type TemplateLineItemInput = {
  category: 'material' | 'labour'
  description: string
  formula: string
  unit: string
}

export type EstimateItemInput = {
  category: 'material' | 'labour'
  description: string
  quantity: number
  unit: string
  unitManhours: number
}

export function evaluateFormula(formula: string, zone: ZoneDimensions): number {
  const expr = formula
    .replace(/area_m2/g, String(zone.areaM2))
    .replace(/perimeter_m/g, String(zone.perimeterM))
    .replace(/height_m/g, String(zone.heightM))
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
  // Only digits, spaces, basic arithmetic operators, decimal points, parentheses
  if (!/^[\d\s+\-*/.()]+$/.test(expr)) {
    throw new Error(`Invalid formula expression: "${formula}"`)
  }
   
  const result = Function(`"use strict"; return (${expr})`)() as number
  if (!Number.isFinite(result)) {
    throw new Error(`Formula produced non-finite result: "${formula}"`)
  }
  return result
}

export function generateEstimateItems(
  lineItems: TemplateLineItemInput[],
  zone: ZoneDimensions,
): EstimateItemInput[] {
  return lineItems.map((li) => {
    const raw = evaluateFormula(li.formula, zone)
    const quantity = Math.round(Math.max(0, raw) * 100) / 100
    return {
      category: li.category,
      description: li.description,
      quantity,
      unit: li.unit,
      unitManhours: li.category === 'labour' ? 1.0 : 0,
    }
  })
}
