'use client'
import React, { useState, useRef } from 'react'
import { Stage, Layer, Rect, Text } from 'react-konva'
import type Konva from 'konva'

export type CanvasRect = { x: number; y: number; width: number; height: number }

export type ZoneOverlay = {
  id: string
  label: string
  canvasData: CanvasRect
  selected: boolean
}

type Props = {
  width: number
  height: number
  zones: ZoneOverlay[]
  onDraftComplete: (rect: CanvasRect) => void
  onSelectZone: (id: string) => void
}

export default function CanvasLayer({ width, height, zones, onDraftComplete, onSelectZone }: Props): React.JSX.Element {
  const [draft, setDraft] = useState<CanvasRect | null>(null)
  const isDrawing = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })

  function toFrac(val: number, max: number) {
    return max > 0 ? val / max : 0
  }

  function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    // Only start drawing on empty stage area, not on zone rects
    if (e.target !== e.target.getStage()) return
    const pos = e.target.getStage()!.getPointerPosition()!
    isDrawing.current = true
    startPos.current = pos
    setDraft({ x: toFrac(pos.x, width), y: toFrac(pos.y, height), width: 0, height: 0 })
  }

  function handleMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    if (!isDrawing.current) return
    const pos = e.target.getStage()!.getPointerPosition()!
    const sx = startPos.current.x
    const sy = startPos.current.y
    setDraft({
      x: toFrac(Math.min(pos.x, sx), width),
      y: toFrac(Math.min(pos.y, sy), height),
      width: toFrac(Math.abs(pos.x - sx), width),
      height: toFrac(Math.abs(pos.y - sy), height),
    })
  }

  function handleMouseUp() {
    if (!isDrawing.current || !draft) return
    isDrawing.current = false
    if (draft.width > 0.01 && draft.height > 0.01) {
      onDraftComplete(draft)
    }
    setDraft(null)
  }

  return (
    <Stage
      width={width}
      height={height}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ position: 'absolute', top: 0, left: 0, cursor: 'crosshair' }}
    >
      <Layer>
        {zones.map((z) => (
          <React.Fragment key={z.id}>
            <Rect
              x={z.canvasData.x * width}
              y={z.canvasData.y * height}
              width={z.canvasData.width * width}
              height={z.canvasData.height * height}
              fill={z.selected ? 'rgba(0,140,62,0.4)' : 'rgba(0,180,81,0.2)'}
              stroke={z.selected ? '#008C3E' : '#00B451'}
              strokeWidth={z.selected ? 2 : 1}
              onClick={() => onSelectZone(z.id)}
              onMouseEnter={(e) => {
                const stage = e.target.getStage()
                if (stage) stage.container().style.cursor = 'pointer'
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage()
                if (stage) stage.container().style.cursor = 'crosshair'
              }}
            />
            <Text
              x={z.canvasData.x * width + 4}
              y={z.canvasData.y * height + 4}
              text={z.label}
              fontSize={12}
              fill="#0D1B2A"
              listening={false}
            />
          </React.Fragment>
        ))}
        {draft && draft.width > 0 && (
          <Rect
            x={draft.x * width}
            y={draft.y * height}
            width={draft.width * width}
            height={draft.height * height}
            fill="rgba(0,180,81,0.1)"
            stroke="#00B451"
            strokeWidth={1}
            dash={[6, 3]}
            listening={false}
          />
        )}
      </Layer>
    </Stage>
  )
}
