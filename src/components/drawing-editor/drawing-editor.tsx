'use client'
import dynamic from 'next/dynamic'
import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import ZonePanel, { ZoneFormValues } from './zone-panel'
import type { CanvasRect, ZoneOverlay } from './canvas-layer'

const PdfViewer = dynamic(() => import('./pdf-viewer'), { ssr: false })
const CanvasLayer = dynamic(() => import('./canvas-layer'), { ssr: false })

type Zone = {
  id: string
  drawingId: string
  pageNumber: number
  label: string
  canvasData: CanvasRect
  accessType: 'ground' | 'elevated' | 'confined' | 'overhead'
  loadingClass: 'light' | 'medium' | 'heavy'
  heightM: number
  perimeterM: number
  areaM2: number
  scaffoldType: 'independent' | 'birdcage' | 'putlog' | 'suspended' | 'cantilever'
  templateId: string | null
  createdAt: string
}

type Drawing = {
  id: string
  jobId: string
  structureId: string
  structureName: string
  filename: string
  blobUrl: string
  pageCount: number
}

type Props = {
  drawing: Drawing
  initialZones: Zone[]
}

export default function DrawingEditor({ drawing, initialZones }: Props) {
  const [zones, setZones] = useState<Zone[]>(initialZones)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(drawing.pageCount)
  const [renderWidth, setRenderWidth] = useState(0)
  const [renderHeight, setRenderHeight] = useState(0)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [draftRect, setDraftRect] = useState<CanvasRect | null>(null)

  const handlePageCount = useCallback((n: number) => setTotalPages(n), [])
  const handleRenderSize = useCallback((w: number, h: number) => {
    setRenderWidth(w)
    setRenderHeight(h)
  }, [])

  const pageZones: ZoneOverlay[] = zones
    .filter((z) => z.pageNumber === currentPage)
    .map((z) => ({ id: z.id, label: z.label, canvasData: z.canvasData, selected: z.id === selectedZoneId }))

  function handleDraftComplete(rect: CanvasRect) {
    setSelectedZoneId(null)
    setDraftRect(rect)
  }

  function handleSelectZone(id: string) {
    setDraftRect(null)
    setSelectedZoneId(id)
  }

  function closePanel() {
    setDraftRect(null)
    setSelectedZoneId(null)
  }

  const selectedZone = selectedZoneId ? zones.find((z) => z.id === selectedZoneId) : null

  const panelMode: 'new' | 'edit' | null =
    draftRect ? 'new' : selectedZone ? 'edit' : null

  async function handleSave(values: ZoneFormValues) {
    if (draftRect) {
      // Create new zone
      const res = await fetch(`/api/jobs/${drawing.jobId}/drawings/${drawing.id}/zones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageNumber: currentPage,
          canvasData: draftRect,
          ...values,
        }),
      })
      if (!res.ok) throw new Error('Failed to save zone')
      const newZone: Zone = await res.json()
      setZones((prev) => [...prev, newZone])
      setDraftRect(null)
      setSelectedZoneId(newZone.id)
    } else if (selectedZone) {
      // Update existing zone
      const res = await fetch(
        `/api/jobs/${drawing.jobId}/drawings/${drawing.id}/zones/${selectedZone.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        },
      )
      if (!res.ok) throw new Error('Failed to update zone')
      const updated: Zone = await res.json()
      setZones((prev) => prev.map((z) => (z.id === updated.id ? updated : z)))
    }
  }

  async function handleDelete() {
    if (!selectedZone) return
    const res = await fetch(
      `/api/jobs/${drawing.jobId}/drawings/${drawing.id}/zones/${selectedZone.id}`,
      { method: 'DELETE' },
    )
    if (!res.ok) throw new Error('Failed to delete zone')
    setZones((prev) => prev.filter((z) => z.id !== selectedZone.id))
    setSelectedZoneId(null)
  }

  const panelInitialValues: Partial<ZoneFormValues> | undefined = selectedZone
    ? {
        label: selectedZone.label,
        accessType: selectedZone.accessType,
        loadingClass: selectedZone.loadingClass,
        heightM: selectedZone.heightM,
        perimeterM: selectedZone.perimeterM,
        areaM2: selectedZone.areaM2,
        scaffoldType: selectedZone.scaffoldType,
        templateId: selectedZone.templateId,
      }
    : undefined

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b border-border flex-shrink-0 bg-card"
      >
        <div>
          <span className="text-sm font-medium">{drawing.filename}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            {drawing.structureName} ({drawing.structureId})
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {zones.filter((z) => z.pageNumber === currentPage).length} zone{zones.length !== 1 ? 's' : ''} on page
          </span>
          {/* Page navigation */}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              style={{ padding: '2px 8px', fontSize: 12 }}
            >
              ‹
            </Button>
            <span className="text-xs text-muted-foreground w-16 text-center">
              {currentPage} / {totalPages}
            </span>
            <Button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              style={{ padding: '2px 8px', fontSize: 12 }}
            >
              ›
            </Button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 overflow-auto bg-muted p-4">
          <div className="relative inline-block" style={{ minWidth: renderWidth || 'auto' }}>
            <PdfViewer
              blobUrl={drawing.blobUrl}
              page={currentPage}
              onPageCount={handlePageCount}
              onRenderSize={handleRenderSize}
            />
            {renderWidth > 0 && renderHeight > 0 && (
              <CanvasLayer
                width={renderWidth}
                height={renderHeight}
                zones={pageZones}
                onDraftComplete={handleDraftComplete}
                onSelectZone={handleSelectZone}
              />
            )}
          </div>
        </div>

        {/* Zone panel */}
        {panelMode && (
          <ZonePanel
            key={selectedZoneId ?? 'new'}
            mode={panelMode}
            initialValues={panelInitialValues}
            onSave={handleSave}
            onDelete={panelMode === 'edit' ? handleDelete : undefined}
            onClose={closePanel}
          />
        )}
      </div>

      {/* Footer hint */}
      {!panelMode && (
        <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border bg-card flex-shrink-0">
          Drag on the PDF to draw a new zone · Click an existing zone to edit it
        </div>
      )}
    </div>
  )
}
