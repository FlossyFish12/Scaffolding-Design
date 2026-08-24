/**
 * Density calculator — port of scaffold_weights_estimator.py:346
 * TG20 / BS EN 12811-1 component & material density
 */

export const TUBE_SPECS = [
  { label: '48.3mm std (4.0mm)', kg_m: 4.37 },
  { label: '48.3mm hi-yield (3.2mm)', kg_m: 3.56 },
  { label: '38mm std (4.0mm)', kg_m: 3.35 },
  { label: '38mm light (3.2mm)', kg_m: 2.75 },
  { label: '48.3mm aluminium', kg_m: 1.5 },
  { label: '38mm aluminium', kg_m: 0.95 },
] as const

export const BOARD_SPECS = [
  { label: 'Timber', kg_m: 4.275 },
  { label: 'LVL', kg_m: 5.13 },
  { label: 'Steel', kg_m: 6.67 },
] as const

export const SCAFFOLD_TYPES = ['Independent', 'Putlog', 'Birdcage'] as const

export const LOAD_CLASSES: Array<[number, number, string]> = [
  [1, 0.75, 'Inspection / very light'],
  [2, 1.5, 'Light'],
  [3, 2.0, 'General construction'],
  [4, 3.0, 'Masonry'],
  [5, 4.5, 'Heavy masonry'],
  [6, 6.0, 'Special heavy'],
]

export const BOARD_WIDTH = 0.225
export const TIE_SPACING = 4.0
export const MAX_HBR = 3.5
export const MAX_TG20_HEIGHT = 50.0

export interface DensityInput {
  zone_name?: string
  bay_length: number
  lift_height: number
  num_bays: number
  num_lifts: number
  boarded_lifts: number
  boards_wide: number
  board_length: number
  tube_idx: number
  board_idx: number
  scaffold_idx: number
  load_class: number
  include_couplers?: boolean
  include_boards?: boolean
}

export interface DensityResult {
  L: number
  W: number
  H: number
  V: number
  zone_name: string
  tube_label: string
  board_label: string
  scaffold_type: string
  load_class: number
  load_class_udl: number
  n_standards: number
  mass_standards: number
  n_ledgers: number
  mass_ledgers: number
  n_transoms: number
  mass_transoms: number
  n_braces: number
  mass_braces: number
  n_couplers: number
  mass_couplers: number
  n_boards: number
  mass_boards: number
  n_ties: number
  total_mass: number
  total_components: number
  mat_density: number
  comp_density: number
  tie_density: number
  hbr: number
  hbr_ok: boolean
  height_ok: boolean
  bay_ok: boolean
  lift_ok: boolean
}

export function calculateDensity(inp: DensityInput): DensityResult {
  const L = inp.num_bays * inp.bay_length
  const W = inp.boards_wide * BOARD_WIDTH
  const H = inp.num_lifts * inp.lift_height
  const V = L * W * H

  const tube = TUBE_SPECS[inp.tube_idx] ?? TUBE_SPECS[0]
  const board = BOARD_SPECS[inp.board_idx] ?? BOARD_SPECS[0]
  const lh = inp.lift_height
  const bl = inp.bay_length
  const nb = inp.num_bays
  const nl = inp.num_lifts
  const blf = inp.boarded_lifts
  const bw = inp.boards_wide

  // Standards
  let n_std: number
  if (inp.scaffold_idx === 0) n_std = (nb + 1) * 2
  else if (inp.scaffold_idx === 1) n_std = (nb + 1) * 1
  else {
    const grid_rows = Math.max(2, Math.floor(W / bl) + 1)
    n_std = (nb + 1) * grid_rows
  }
  const std_len = n_std * H

  // Ledgers
  const n_lev = nl + 1
  let n_leg: number
  let leg_len: number
  if (inp.scaffold_idx === 0) {
    n_leg = nb * 2 * n_lev
    leg_len = n_leg * bl
  } else if (inp.scaffold_idx === 1) {
    n_leg = nb * 1 * n_lev
    leg_len = n_leg * bl
  } else {
    const grid_rows = Math.max(2, Math.floor(W / bl) + 1)
    const n_leg_long = nb * grid_rows * n_lev
    const n_leg_short = (grid_rows - 1) * (nb + 1) * n_lev
    n_leg = n_leg_long + n_leg_short
    leg_len = n_leg_long * bl + n_leg_short * bl
  }

  // Transoms
  const n_trn = (nb + 1) * blf
  const trn_len = n_trn * W

  // Braces
  const main_tube_len = std_len + leg_len + trn_len
  const brace_len = 0.08 * main_tube_len
  const n_brace = Math.max(4, Math.floor(brace_len / bl))

  // Mass
  const mass_std = std_len * tube.kg_m
  const mass_leg = leg_len * tube.kg_m
  const mass_trn = trn_len * tube.kg_m
  const mass_brc = brace_len * tube.kg_m
  const mass_tube = mass_std + mass_leg + mass_trn + mass_brc

  // Couplers
  const total_joints = n_std + n_leg + n_trn + n_brace
  const n_coup = Math.floor(total_joints * 2.2)
  const mass_coup = n_coup * 0.9

  // Boards
  const n_bds = nb * bw * blf
  const mass_bds = n_bds * inp.board_length * board.kg_m

  // Ties
  const ties_h = Math.max(1, Math.ceil(L / TIE_SPACING) + 1)
  const ties_v = Math.max(1, Math.ceil(H / TIE_SPACING))
  const n_ties = ties_h * ties_v

  const inc_coup = inp.include_couplers ?? true
  const inc_bds = inp.include_boards ?? true
  let total_mass = mass_tube
  let total_components = n_std + n_leg + n_trn + n_brace
  if (inc_coup) {
    total_mass += mass_coup
    total_components += n_coup
  }
  if (inc_bds) {
    total_mass += mass_bds
    total_components += n_bds
  }

  const mat_density = V > 0 ? total_mass / V : 0
  const comp_density = V > 0 ? total_components / V : 0
  const tie_density = V > 0 ? n_ties / V : 0
  const hbr = W > 0 ? H / W : 99

  const lc = LOAD_CLASSES[inp.load_class - 1]

  return {
    L: Math.round(L * 100) / 100,
    W: Math.round(W * 1000) / 1000,
    H: Math.round(H * 100) / 100,
    V: Math.round(V * 100) / 100,
    zone_name: inp.zone_name ?? 'Zone',
    tube_label: tube.label,
    board_label: board.label,
    scaffold_type: SCAFFOLD_TYPES[inp.scaffold_idx] ?? SCAFFOLD_TYPES[0],
    load_class: inp.load_class,
    load_class_udl: lc ? lc[1] : 0,
    n_standards: n_std,
    mass_standards: Math.round(mass_std * 10) / 10,
    n_ledgers: n_leg,
    mass_ledgers: Math.round(mass_leg * 10) / 10,
    n_transoms: n_trn,
    mass_transoms: Math.round(mass_trn * 10) / 10,
    n_braces: n_brace,
    mass_braces: Math.round(mass_brc * 10) / 10,
    n_couplers: n_coup,
    mass_couplers: Math.round(mass_coup * 10) / 10,
    n_boards: n_bds,
    mass_boards: Math.round(mass_bds * 10) / 10,
    n_ties,
    total_mass: Math.round(total_mass * 10) / 10,
    total_components,
    mat_density: Math.round(mat_density * 100) / 100,
    comp_density: Math.round(comp_density * 100) / 100,
    tie_density: Math.round(tie_density * 100) / 100,
    hbr: Math.round(hbr * 10) / 10,
    hbr_ok: hbr <= MAX_HBR,
    height_ok: H <= MAX_TG20_HEIGHT,
    bay_ok: bl <= 2.0,
    lift_ok: lh <= 2.0,
  }
}
