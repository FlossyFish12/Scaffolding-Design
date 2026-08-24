import type { ScaffoldParams } from './types'

export interface MtoItem {
  item: string
  qty: number
  unit: string
  notes: string
}

export interface MtoResult {
  items: MtoItem[]
  markdownTable: string
}

export function calculateMto(params: ScaffoldParams): MtoResult {
  const num_lifts = Math.ceil(params.height_m / params.lift_height_m)
  const scaffold_width_m = params.boards * 0.225 + 0.2

  // Standards (uprights)
  const std_qty = 2 * (params.num_bays + 1)
  const std_lm = +(std_qty * (params.height_m + 0.5)).toFixed(1)
  const standards: MtoItem = {
    item: 'Standards (48.3mm tube)',
    qty: std_lm,
    unit: 'linear m',
    notes: `${std_qty} No. × ${(params.height_m + 0.5).toFixed(1)} m`,
  }

  // Ledgers (longitudinal tubes)
  const ledger_tubes = 3 * num_lifts * params.num_bays
  const ledger_lm = +(ledger_tubes * params.bay_length_m).toFixed(1)
  const ledgers: MtoItem = {
    item: 'Ledgers (48.3mm tube)',
    qty: ledger_lm,
    unit: 'linear m',
    notes: `${ledger_tubes} No. × ${params.bay_length_m} m`,
  }

  // Transoms (cross tubes)
  const end_qty = (params.num_bays + 1) * num_lifts
  const mid_qty = Math.max(0, params.boards - 2) * params.num_bays * num_lifts
  const total_qty = end_qty + mid_qty
  const unit_length = +(scaffold_width_m + 0.3).toFixed(2)
  const total_lm = +(total_qty * unit_length).toFixed(1)
  const transoms: MtoItem = {
    item: 'Transoms (48.3mm tube)',
    qty: total_lm,
    unit: 'linear m',
    notes: `${total_qty} No. × ${unit_length} m`,
  }

  // Scaffold boards
  const board_qty = params.boards * params.num_bays * num_lifts
  const boards: MtoItem = {
    item: 'Scaffold boards (225mm)',
    qty: board_qty,
    unit: 'No.',
    notes: `${params.boards} wide × ${params.num_bays} bays × ${num_lifts} lifts`,
  }

  // Base plates
  const base_qty = 2 * (params.num_bays + 1)
  const basePlates: MtoItem = {
    item: 'Base plates',
    qty: base_qty,
    unit: 'No.',
    notes: 'One per standard',
  }

  // Sole boards (timber)
  const sole_qty = 2 * (params.num_bays + 1)
  const soleBoards: MtoItem = {
    item: 'Sole boards (225×38mm timber)',
    qty: sole_qty,
    unit: 'No.',
    notes: 'One per base plate',
  }

  // Ties
  let tie_qty: number
  if (params.tie_pattern === 'alternate') {
    tie_qty = Math.ceil(num_lifts / 2) * Math.ceil(params.num_bays / 2)
  } else if (params.tie_pattern === 'every_lift') {
    tie_qty = num_lifts * Math.ceil(params.num_bays / 2)
  } else {
    // every_bay
    tie_qty = num_lifts * (params.num_bays + 1)
  }
  const ties: MtoItem = {
    item: 'Reveal ties / anchor ties',
    qty: tie_qty,
    unit: 'No.',
    notes: `Pattern: ${params.tie_pattern.replace('_', ' ')}`,
  }

  // Right-angle couplers
  const rac_qty = 6 * (params.num_bays + 1) * num_lifts
  const rightAngleCouplers: MtoItem = {
    item: 'Right-angle couplers',
    qty: rac_qty,
    unit: 'No.',
    notes: 'Approx. 6 per standard per lift',
  }

  // Swivel couplers (bracing)
  const swivel_qty = 4 * Math.ceil(params.num_bays / 3) * num_lifts
  const swivelCouplers: MtoItem = {
    item: 'Swivel couplers (bracing)',
    qty: swivel_qty,
    unit: 'No.',
    notes: 'Approx. 4 per 3 bays per lift',
  }

  const items: MtoItem[] = [
    standards,
    ledgers,
    transoms,
    boards,
    basePlates,
    soleBoards,
    ties,
    rightAngleCouplers,
    swivelCouplers,
  ]

  // Build markdown table
  const run_m = (params.num_bays * params.bay_length_m).toFixed(1)
  const header = [
    `## Material Take-Off — ${params.job_ref}`,
    ``,
    `**Scaffold:** ${params.height_m} m high × ${params.num_bays} bays @ ${params.bay_length_m} m = ${run_m} m run  `,
    `**Lifts:** ${num_lifts} × ${params.lift_height_m} m | **Boards:** ${params.boards} wide | **Tie pattern:** ${params.tie_pattern}`,
    ``,
    `| Item | Qty | Unit | Notes |`,
    `|------|-----|------|-------|`,
  ]

  const rows = items.map(
    (i) => `| ${i.item} | ${i.qty} | ${i.unit} | ${i.notes} |`
  )

  const footer = [
    ``,
    `> Quantities are indicative estimates. Add 10% waste/laps. Verify against site-specific design.`,
  ]

  const markdownTable = [...header, ...rows, ...footer].join('\n')

  return { items, markdownTable }
}
