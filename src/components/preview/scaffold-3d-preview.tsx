'use client'
import { useEffect, useRef, useState } from 'react'

type Props = {
  heightM: number
  bayLengthM: number
  numBays: number
  boardsWide: number
  liftHeightM: number
  scaffoldType?: string
}

export default function Scaffold3DPreview({ heightM, bayLengthM, numBays, boardsWide, liftHeightM, scaffoldType = 'independent' }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let renderer: any
    let animationId: number

    async function init() {
      try {
        const THREE = await import('three')
        // Use dynamic import for OrbitControls to avoid SSR issues
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')

        if (!mountRef.current || cancelled) return

        const container = mountRef.current
        const width = container.clientWidth
        const height = 260

        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0x0f172a)

        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
        const scaffoldL = bayLengthM * numBays
        const scaffoldW = boardsWide * 0.225 + 0.4
        const scaffoldH = heightM

        // Position camera to view scaffold diagonally
        const maxDim = Math.max(scaffoldL, scaffoldW, scaffoldH)
        camera.position.set(scaffoldL * 0.7, scaffoldH * 0.6, scaffoldW * 1.8 + maxDim * 0.5)
        camera.lookAt(scaffoldL / 2, scaffoldH / 2, scaffoldW / 2)

        renderer = new THREE.WebGLRenderer({ antialias: true })
        renderer.setSize(width, height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        container.innerHTML = ''
        container.appendChild(renderer.domElement)

        const controls = new OrbitControls(camera, renderer.domElement)
        controls.target.set(scaffoldL / 2, scaffoldH / 2, scaffoldW / 2)
        controls.enableDamping = true
        controls.update()

        // Lights
        const ambient = new THREE.AmbientLight(0xffffff, 0.8)
        scene.add(ambient)
        const dir = new THREE.DirectionalLight(0xffffff, 0.9)
        dir.position.set(5, 10, 5)
        scene.add(dir)

        // Ground
        const groundGeo = new THREE.PlaneGeometry(scaffoldL + 4, scaffoldW + 4)
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x1e293b })
        const ground = new THREE.Mesh(groundGeo, groundMat)
        ground.rotation.x = -Math.PI / 2
        ground.position.set(scaffoldL / 2, 0, scaffoldW / 2)
        scene.add(ground)

        // Grid helper
        const grid = new THREE.GridHelper(Math.max(scaffoldL, scaffoldW) + 4, 10, 0x334155, 0x1e293b)
        grid.position.set(scaffoldL / 2, 0.01, scaffoldW / 2)
        scene.add(grid)

        // Materials
        const stdMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8 })
        const ledgerMat = new THREE.MeshStandardMaterial({ color: 0x64748b })
        const boardMat = new THREE.MeshStandardMaterial({ color: 0xd97706 })
        const guardMat = new THREE.MeshStandardMaterial({ color: 0x60a5fa })

        const tubeRadius = 0.04
        const numLifts = Math.ceil(scaffoldH / liftHeightM)

        // Standards (vertical) — (numBays+1)*2 for independent
        const isBirdcage = scaffoldType === 'birdcage'
        const gridRows = isBirdcage ? Math.max(2, Math.floor(scaffoldW / bayLengthM) + 1) : 2
        const xCount = numBays + 1
        const zPositions = isBirdcage
          ? Array.from({ length: gridRows }, (_, i) => (scaffoldW * i) / (gridRows - 1))
          : [0, scaffoldW]

        for (const z of zPositions) {
          for (let xi = 0; xi < xCount; xi++) {
            const x = (scaffoldL * xi) / numBays
            const geo = new THREE.CylinderGeometry(tubeRadius, tubeRadius, scaffoldH, 8)
            const mesh = new THREE.Mesh(geo, stdMat)
            mesh.position.set(x, scaffoldH / 2, z)
            scene.add(mesh)
          }
        }

        // Ledgers (horizontal along length) — per lift
        for (let lift = 1; lift <= numLifts; lift++) {
          const y = lift * liftHeightM
          if (y > scaffoldH + 0.01) continue
          for (const z of zPositions) {
            const geo = new THREE.BoxGeometry(scaffoldL, 0.06, 0.06)
            const mesh = new THREE.Mesh(geo, ledgerMat)
            mesh.position.set(scaffoldL / 2, y, z)
            scene.add(mesh)
          }
          // Short ledgers for birdcage (along width)
          if (isBirdcage && zPositions.length > 2) {
            for (let xi = 0; xi < xCount; xi++) {
              const x = (scaffoldL * xi) / numBays
              const geo = new THREE.BoxGeometry(0.06, 0.06, scaffoldW)
              const mesh = new THREE.Mesh(geo, ledgerMat)
              mesh.position.set(x, y, scaffoldW / 2)
              scene.add(mesh)
            }
          }
        }

        // Transoms + boards per lift (simplified)
        for (let lift = 1; lift <= numLifts; lift++) {
          const y = lift * liftHeightM
          if (y > scaffoldH + 0.01) continue
          // Boards as thin boxes
          const boardGeo = new THREE.BoxGeometry(scaffoldL - 0.1, 0.04, scaffoldW - 0.1)
          const board = new THREE.Mesh(boardGeo, boardMat)
          board.position.set(scaffoldL / 2, y, scaffoldW / 2)
          scene.add(board)

          // Guard rails at working lifts (top of board +1m)
          const guardY = y + 1.0
          if (guardY <= scaffoldH + 0.01) {
            for (const z of [0, scaffoldW]) {
              const geo = new THREE.BoxGeometry(scaffoldL, 0.04, 0.04)
              const mesh = new THREE.Mesh(geo, guardMat)
              mesh.position.set(scaffoldL / 2, guardY, z)
              scene.add(mesh)
            }
            // End guards
            const endGeo = new THREE.BoxGeometry(0.04, 0.04, scaffoldW)
            for (const x of [0, scaffoldL]) {
              const mesh = new THREE.Mesh(endGeo, guardMat)
              mesh.position.set(x, guardY, scaffoldW / 2)
              scene.add(mesh)
            }
          }
        }

        // Ties (green spheres at intervals)
        const tieIntervalBays = 2
        for (let lift = 1; lift <= numLifts; lift++) {
          if (lift % 2 === 0) continue // alternate
          const y = lift * liftHeightM
          for (let xi = 1; xi < xCount - 1; xi += tieIntervalBays) {
            const x = (scaffoldL * xi) / numBays
            const geo = new THREE.SphereGeometry(0.12, 8, 8)
            const mat = new THREE.MeshStandardMaterial({ color: 0x4ade80 })
            const mesh = new THREE.Mesh(geo, mat)
            mesh.position.set(x, y, scaffoldW + 0.18)
            scene.add(mesh)
            // line to scaffold
            const lineGeo = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(x, y, scaffoldW),
              new THREE.Vector3(x, y, scaffoldW + 0.18),
            ])
            const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x4ade80 }))
            scene.add(line)
          }
        }

        function animate() {
          animationId = requestAnimationFrame(animate)
          controls.update()
          renderer.render(scene, camera)
        }
        animate()

        function onResize() {
          if (!container) return
          const w = container.clientWidth
          camera.aspect = w / height
          camera.updateProjectionMatrix()
          renderer.setSize(w, height)
        }
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '3D load failed')
      }
    }

    init()

    return () => {
      cancelled = true
      if (animationId) cancelAnimationFrame(animationId)
      if (renderer) {
        renderer.dispose()
        mountRef.current?.replaceChildren()
      }
    }
  }, [heightM, bayLengthM, numBays, boardsWide, liftHeightM, scaffoldType])

  if (error) {
    return <div className="text-xs text-red-600 p-2 border rounded bg-red-50">{error}</div>
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">3D Preview — {scaffoldType} · {numBays} bays × {bayLengthM}m · {heightM}m</p>
      <div ref={mountRef} className="w-full rounded border overflow-hidden" style={{ height: 260, background: '#0f172a' }} />
      <p className="text-xs text-muted-foreground">Drag to orbit · Scroll to zoom · Shift+drag to pan</p>
    </div>
  )
}
