'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

type Props = {
  blobUrl: string
  page: number
  onPageCount: (n: number) => void
  onRenderSize: (w: number, h: number) => void
}

export default function PdfViewer({ blobUrl, page, onPageCount, onRenderSize }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableOnPageCount = useCallback(onPageCount, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableOnRenderSize = useCallback(onRenderSize, [])

  useEffect(() => {
    let cancelled = false
    setStatus('loading')

    async function render() {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

        const pdf = await pdfjsLib.getDocument({ url: blobUrl }).promise
        if (cancelled) return
        stableOnPageCount(pdf.numPages)

        const pdfPage = await pdf.getPage(page)
        if (cancelled) return

        const viewport = pdfPage.getViewport({ scale: 1.5 })
        const canvas = canvasRef.current
        if (!canvas || cancelled) return

        canvas.width = viewport.width
        canvas.height = viewport.height
        stableOnRenderSize(viewport.width, viewport.height)

        await pdfPage.render({ canvas, viewport }).promise

        if (!cancelled) setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    render()
    return () => { cancelled = true }
  }, [blobUrl, page, stableOnPageCount, stableOnRenderSize])

  return (
    <div className="relative inline-block">
      <canvas ref={canvasRef} style={{ display: 'block' }} />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70">
          <span className="text-sm text-muted-foreground">Loading PDF…</span>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70">
          <span className="text-sm text-destructive">Could not load PDF</span>
        </div>
      )}
    </div>
  )
}
