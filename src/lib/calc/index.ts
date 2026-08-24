import { validate } from './parameters'
import { check as tg20Check } from './tg20Compliance'
import { checkStructural } from './structural'
import { generateCalcSheet, generateMethodStatement } from './output'
import { CalcResult } from './types'

export function runCalc(input: Record<string, unknown>): CalcResult {
  const { params, errors, warnings } = validate(input)

  if (errors.length > 0 || !params) {
    throw new Error(`Validation failed: ${errors.join('; ')}`)
  }

  const tg20Result = tg20Check(params)
  let structuralResult = null
  let verdict: CalcResult['verdict']

  if (tg20Result.compliant) {
    verdict = 'compliant'
  } else {
    const legLoadKn = tg20Result.maxLegLoadKn ?? 40.0
    structuralResult = checkStructural(
      params.lift_height_m,
      legLoadKn,
      legLoadKn,
      params.ground_bearing_kpa,
    )
    verdict = structuralResult.requiresEngineer ? 'requires_engineer' : 'non_compliant'
  }

  const checks = [
    ...tg20Result.checks,
    ...(structuralResult?.checks ?? []),
  ]

  return {
    jobRef: params.job_ref,
    verdict,
    tg20Compliant: tg20Result.compliant,
    requiresEngineer: verdict === 'requires_engineer',
    warnings,
    checks,
    calcSheet: generateCalcSheet(params, tg20Result, structuralResult, warnings),
    methodStatement: generateMethodStatement(params, tg20Result, structuralResult, warnings),
  }
}
