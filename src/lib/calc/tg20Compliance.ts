import { ScaffoldParams, ComplianceResult, ComplianceCheck, Tg20Tables } from './types'
import defaultTables from './data/tg20Tables.json'

function findConfig(params: ScaffoldParams, tables: Tg20Tables) {
  return tables.standard_configurations.find(c =>
    Math.abs(c.bay_length_m - params.bay_length_m) <= 0.05 &&
    Math.abs(c.lift_height_m - params.lift_height_m) <= 0.05 &&
    c.boards === params.boards &&
    c.wind_zone === params.wind_zone &&
    c.tie_pattern === params.tie_pattern
  ) ?? null
}

export function check(params: ScaffoldParams, tables: Tg20Tables = defaultTables as Tg20Tables): ComplianceResult {
  const config = findConfig(params, tables)

  if (!config) {
    return { standardConfigFound: false, compliant: false, checks: [], maxLegLoadKn: null }
  }

  const factor = tables.load_class_height_factors[String(params.load_class)] ?? 1.0
  const maxHeight = config.max_height_m * factor
  const passed = params.height_m <= maxHeight

  const heightCheck: ComplianceCheck = {
    name: 'Maximum height',
    passed,
    actual: params.height_m,
    limit: maxHeight,
    unit: 'm',
    clause: 'TG20:13 Table B.1',
  }

  return {
    standardConfigFound: true,
    compliant: passed,
    checks: [heightCheck],
    maxLegLoadKn: config.max_leg_load_kn,
  }
}
