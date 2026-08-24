'use client'

import { ScaffoldParams } from '@/lib/calc/types'

interface ElevationViewProps {
  params: ScaffoldParams
}

export function ElevationView({ params }: ElevationViewProps) {
  const MARGIN = { top: 36, right: 80, bottom: 50, left: 70 }
  const SVG_W = 500
  const MAX_DRAW_H = 400
  const scale = Math.min(MAX_DRAW_H / params.height_m, 120)
  const drawH = params.height_m * scale
  const drawW = Math.max(params.bay_length_m * scale, 80)
  const SVG_H = drawH + MARGIN.top + MARGIN.bottom
  const ox = MARGIN.left

  const Y = (h: number) => MARGIN.top + drawH - h * scale

  const numLifts = Math.ceil(params.height_m / params.lift_height_m)

  const tiedLifts = (i: number): boolean => {
    if (params.tie_pattern === 'alternate') return i % 2 === 1
    return true // every_lift and every_bay
  }

  // Arrowhead polygon points (pointing up or down)
  const arrowUp = (x: number, y: number) =>
    `${x},${y} ${x - 4},${y + 8} ${x + 4},${y + 8}`
  const arrowDown = (x: number, y: number) =>
    `${x},${y} ${x - 4},${y - 8} ${x + 4},${y - 8}`
  const arrowLeft = (x: number, y: number) =>
    `${x},${y} ${x + 8},${y - 4} ${x + 8},${y + 4}`
  const arrowRight = (x: number, y: number) =>
    `${x},${y} ${x - 8},${y - 4} ${x - 8},${y + 4}`

  const groundY = Y(0)
  const topY = Y(params.height_m)

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        2D Elevation View
      </p>
      <p className="text-xs text-slate-500">
        Front elevation — single bay ({params.bay_length_m} m) — {numLifts} lift
        {numLifts !== 1 ? 's' : ''}
      </p>
      <div className="overflow-x-auto">
        <svg
          width={SVG_W}
          height={SVG_H}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="max-w-full"
          aria-label="Scaffold front elevation drawing"
        >
          {/* 1. Background */}
          <rect width={SVG_W} height={SVG_H} fill="#0f172a" />

          {/* 2. Ground line */}
          <line
            x1={ox - 15}
            y1={groundY}
            x2={ox + drawW + 15}
            y2={groundY}
            stroke="#475569"
            strokeWidth={2}
          />

          {/* 3. Ground hatch — left side */}
          {Array.from({ length: 5 }, (_, i) => (
            <line
              key={`hl${i}`}
              x1={ox - 10 + i * 15}
              y1={groundY}
              x2={ox - 10 + i * 15 - 10}
              y2={groundY + 10}
              stroke="#334155"
              strokeWidth={1}
            />
          ))}
          {/* Ground hatch — right side */}
          {Array.from({ length: 5 }, (_, i) => (
            <line
              key={`hr${i}`}
              x1={ox + drawW - 10 + i * 15}
              y1={groundY}
              x2={ox + drawW - 10 + i * 15 - 10}
              y2={groundY + 10}
              stroke="#334155"
              strokeWidth={1}
            />
          ))}

          {/* 4. Base plates */}
          <rect x={ox - 4} y={groundY} width={20} height={6} fill="#64748b" />
          <rect
            x={ox + drawW - 16}
            y={groundY}
            width={20}
            height={6}
            fill="#64748b"
          />

          {/* 5. Standards (uprights) */}
          <rect
            x={ox + 1}
            y={topY}
            width={6}
            height={params.height_m * scale}
            fill="#94a3b8"
          />
          <rect
            x={ox + drawW - 7}
            y={topY}
            width={6}
            height={params.height_m * scale}
            fill="#94a3b8"
          />

          {/* 6. Ledgers + platforms + guardrails */}
          {Array.from({ length: numLifts }, (_, idx) => {
            const i = idx + 1
            const liftH = i * params.lift_height_m
            const platformY = Y(liftH)

            // Ledger tube (behind the boards)
            const ledgerY = platformY

            // Working platform boards (amber)
            const boardY = ledgerY - 2

            // Guardrail 1m above platform (if it doesn't exceed scaffold top)
            const guardrailH = liftH + 1.0
            const showGuardrail = guardrailH <= params.height_m + 0.01

            // Mid-rail 0.5m above platform
            const midrailH = liftH + 0.5
            const showMidrail = midrailH <= params.height_m + 0.01

            return (
              <g key={`lift-${i}`}>
                {/* Ledger tube (thin grey line behind boards) */}
                <rect
                  x={ox + 7}
                  y={ledgerY - 1}
                  width={drawW - 14}
                  height={3}
                  fill="#64748b"
                />
                {/* Working platform boards */}
                <rect
                  x={ox + 7}
                  y={boardY}
                  width={drawW - 14}
                  height={5}
                  fill="#d97706"
                />
                {/* Mid-rail */}
                {showMidrail && (
                  <line
                    x1={ox + 8}
                    y1={Y(midrailH)}
                    x2={ox + drawW - 8}
                    y2={Y(midrailH)}
                    stroke="#60a5fa"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                  />
                )}
                {/* Guardrail */}
                {showGuardrail && (
                  <line
                    x1={ox + 8}
                    y1={Y(guardrailH)}
                    x2={ox + drawW - 8}
                    y2={Y(guardrailH)}
                    stroke="#60a5fa"
                    strokeWidth={2}
                  />
                )}
              </g>
            )
          })}

          {/* Top guardrail at scaffold head */}
          <line
            x1={ox + 7}
            y1={topY - 1}
            x2={ox + drawW - 7}
            y2={topY - 1}
            stroke="#60a5fa"
            strokeWidth={2}
          />

          {/* 7. Tie symbols */}
          {Array.from({ length: numLifts }, (_, idx) => {
            const i = idx + 1
            if (!tiedLifts(i)) return null
            const ty = Y(i * params.lift_height_m)
            const tx = ox + drawW + 2
            return (
              <g key={`tie-${i}`}>
                {/* Horizontal arm to wall */}
                <line
                  x1={tx}
                  y1={ty}
                  x2={tx + 12}
                  y2={ty}
                  stroke="#4ade80"
                  strokeWidth={2}
                />
                {/* Vertical wall plate */}
                <line
                  x1={tx + 12}
                  y1={ty - 5}
                  x2={tx + 12}
                  y2={ty + 5}
                  stroke="#4ade80"
                  strokeWidth={2}
                />
                {/* Connection circle */}
                <circle cx={tx + 3} cy={ty} r={3} fill="#4ade80" />
              </g>
            )
          })}

          {/* 8. Dimension labels */}

          {/* Total height — left side double-headed arrow */}
          <line
            x1={ox - 38}
            y1={groundY}
            x2={ox - 38}
            y2={topY}
            stroke="#64748b"
            strokeWidth={1}
          />
          <polygon
            points={arrowUp(ox - 38, topY)}
            fill="#64748b"
          />
          <polygon
            points={arrowDown(ox - 38, groundY)}
            fill="#64748b"
          />
          <text
            x={ox - 42}
            y={Y(params.height_m / 2)}
            fill="#94a3b8"
            fontSize={10}
            textAnchor="end"
            dominantBaseline="middle"
          >
            {params.height_m} m
          </text>

          {/* Bay length — bottom double-headed arrow */}
          <line
            x1={ox + 8}
            y1={groundY + 22}
            x2={ox + drawW - 8}
            y2={groundY + 22}
            stroke="#64748b"
            strokeWidth={1}
          />
          <polygon
            points={arrowLeft(ox + 8, groundY + 22)}
            fill="#64748b"
          />
          <polygon
            points={arrowRight(ox + drawW - 8, groundY + 22)}
            fill="#64748b"
          />
          <text
            x={ox + drawW / 2}
            y={groundY + 36}
            fill="#94a3b8"
            fontSize={10}
            textAnchor="middle"
          >
            {params.bay_length_m} m
          </text>

          {/* Lift height — right side label for first lift */}
          {numLifts >= 1 && (
            <>
              <line
                x1={ox + drawW + 30}
                y1={groundY}
                x2={ox + drawW + 30}
                y2={Y(params.lift_height_m)}
                stroke="#64748b"
                strokeWidth={1}
                strokeDasharray="3 2"
              />
              <text
                x={ox + drawW + 34}
                y={Y(params.lift_height_m / 2)}
                fill="#94a3b8"
                fontSize={9}
                dominantBaseline="middle"
              >
                {params.lift_height_m} m
              </text>
            </>
          )}

          {/* 9. Title */}
          <text
            x={SVG_W / 2}
            y={MARGIN.top / 2}
            textAnchor="middle"
            fill="#94a3b8"
            fontSize={11}
          >
            Front Elevation — 1 Bay × {params.num_bays} bay
            {params.num_bays !== 1 ? 's' : ''} total
          </text>

          {/* 10. Legend */}
          {(() => {
            const lx = SVG_W - 130
            const ly = MARGIN.top + 10
            const gap = 18
            return (
              <g fontSize={9} fill="#94a3b8">
                {/* Working platform */}
                <rect x={lx} y={ly} width={14} height={6} fill="#d97706" />
                <text x={lx + 18} y={ly + 5}>
                  Working platform
                </text>
                {/* Guard rail */}
                <line
                  x1={lx}
                  y1={ly + gap + 3}
                  x2={lx + 14}
                  y2={ly + gap + 3}
                  stroke="#60a5fa"
                  strokeWidth={2}
                />
                <text x={lx + 18} y={ly + gap + 6}>
                  Guard / mid rail
                </text>
                {/* Tie */}
                <circle
                  cx={lx + 7}
                  cy={ly + gap * 2 + 3}
                  r={3}
                  fill="#4ade80"
                />
                <text x={lx + 18} y={ly + gap * 2 + 6}>
                  Wall tie
                </text>
              </g>
            )
          })()}
        </svg>
      </div>
    </div>
  )
}
