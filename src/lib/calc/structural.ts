import { StructuralResult, StructuralCheck, TubeProps } from './types'
import defaultProps from './data/tubeProperties.json'

function bucklingCapacityKn(liftHeightM: number, tube: TubeProps['tube']): number {
  const Le = liftHeightM * 1000
  const lam = Le / tube.iy_mm
  const lam1 = Math.PI * Math.sqrt(tube.E_mpa / tube.fy_mpa)
  const lamBar = lam / lam1
  const alpha = tube.imperfection_factor
  const phi = 0.5 * (1 + alpha * (lamBar - 0.2) + lamBar ** 2)
  const chi = Math.min(1.0 / (phi + Math.sqrt(Math.max(phi ** 2 - lamBar ** 2, 0))), 1.0)
  return (chi * tube.area_mm2 * tube.fy_mpa) / tube.gamma_M1 / 1000
}

export function checkStructural(
  liftHeightM: number,
  legLoadKn: number,
  baseLoadKn: number,
  groundBearingKpa: number,
  props: TubeProps = defaultProps as TubeProps,
): StructuralResult {
  const nbRd = bucklingCapacityKn(liftHeightM, props.tube)
  const bucklingPassed = legLoadKn <= nbRd

  const basePlateAreaM2 = props.base_plate.bearing_area_mm2 / 1e6
  const actualBearingKpa = baseLoadKn / basePlateAreaM2
  const bearingPassed = actualBearingKpa <= groundBearingKpa

  const checks: StructuralCheck[] = [
    {
      name: 'Leg buckling',
      passed: bucklingPassed,
      actual: Math.round(legLoadKn * 100) / 100,
      limit: Math.round(nbRd * 100) / 100,
      unit: 'kN',
      clause: 'EN 1993-1-1 §6.3.1',
    },
    {
      name: 'Ground bearing',
      passed: bearingPassed,
      actual: Math.round(actualBearingKpa * 10) / 10,
      limit: groundBearingKpa,
      unit: 'kPa',
      clause: 'BS EN 5975 §7.3',
    },
  ]

  const requiresEngineer = !bucklingPassed || !bearingPassed

  return { passed: !requiresEngineer, requiresEngineer, checks }
}
