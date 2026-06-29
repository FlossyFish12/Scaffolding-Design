import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  prisma: {
    drawing: { findUnique: vi.fn() },
    zone: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { GET as getList, POST } from '../route'
import { GET as getOne, PATCH, DELETE } from '../[zoneId]/route'
import { prisma } from '@/lib/db'

const DRAWING_PARAMS = { params: Promise.resolve({ jobId: 'j1', drawingId: 'd1' }) }
const ZONE_PARAMS   = { params: Promise.resolve({ jobId: 'j1', drawingId: 'd1', zoneId: 'z1' }) }

const mockZone = {
  id: 'z1', drawingId: 'd1', pageNumber: 1, label: 'Zone A',
  canvasData: { x: 0.1, y: 0.1, width: 0.3, height: 0.2 },
  accessType: 'ground', loadingClass: 'light', heightM: 4,
  perimeterM: 20, areaM2: 16, scaffoldType: 'independent',
  templateId: null, createdAt: new Date(),
}

const validBody = {
  pageNumber: 1, label: 'Zone A',
  canvasData: { x: 0.1, y: 0.1, width: 0.3, height: 0.2 },
  accessType: 'ground', loadingClass: 'light',
  heightM: 4, perimeterM: 20, areaM2: 16,
  scaffoldType: 'independent',
}

describe('GET /zones', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns zones list with 200', async () => {
    vi.mocked(prisma.drawing.findUnique).mockResolvedValue({ id: 'd1' } as any)
    vi.mocked(prisma.zone.findMany).mockResolvedValue([mockZone] as any)
    const res = await getList(new NextRequest('http://localhost'), DRAWING_PARAMS)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
  })

  it('returns 404 when drawing not found', async () => {
    vi.mocked(prisma.drawing.findUnique).mockResolvedValue(null)
    const res = await getList(new NextRequest('http://localhost'), DRAWING_PARAMS)
    expect(res.status).toBe(404)
  })
})

describe('POST /zones', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a zone and returns 201', async () => {
    vi.mocked(prisma.drawing.findUnique).mockResolvedValue({ id: 'd1' } as any)
    vi.mocked(prisma.zone.create).mockResolvedValue(mockZone as any)
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, DRAWING_PARAMS)
    expect(res.status).toBe(201)
  })

  it('returns 400 for missing label', async () => {
    vi.mocked(prisma.drawing.findUnique).mockResolvedValue({ id: 'd1' } as any)
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ ...validBody, label: '' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, DRAWING_PARAMS)
    expect(res.status).toBe(400)
  })

  it('returns 404 when drawing not found', async () => {
    vi.mocked(prisma.drawing.findUnique).mockResolvedValue(null)
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, DRAWING_PARAMS)
    expect(res.status).toBe(404)
  })
})

describe('GET /zones/[zoneId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns zone with 200', async () => {
    vi.mocked(prisma.zone.findUnique).mockResolvedValue({ ...mockZone, estimateItems: [] } as any)
    const res = await getOne(new NextRequest('http://localhost'), ZONE_PARAMS)
    expect(res.status).toBe(200)
  })

  it('returns 404 for unknown zone', async () => {
    vi.mocked(prisma.zone.findUnique).mockResolvedValue(null)
    const res = await getOne(new NextRequest('http://localhost'), ZONE_PARAMS)
    expect(res.status).toBe(404)
  })
})

describe('PATCH /zones/[zoneId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates zone and returns 200', async () => {
    vi.mocked(prisma.zone.update).mockResolvedValue({ ...mockZone, label: 'Zone B' } as any)
    const req = new NextRequest('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ label: 'Zone B' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, ZONE_PARAMS)
    expect(res.status).toBe(200)
  })

  it('returns 404 for unknown zone (P2025)', async () => {
    const err = Object.assign(new Error('not found'), { code: 'P2025' })
    vi.mocked(prisma.zone.update).mockRejectedValue(err)
    const req = new NextRequest('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ label: 'X' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, ZONE_PARAMS)
    expect(res.status).toBe(404)
  })
})

describe('DELETE /zones/[zoneId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes zone and returns 204', async () => {
    vi.mocked(prisma.zone.delete).mockResolvedValue(mockZone as any)
    const res = await DELETE(new NextRequest('http://localhost'), ZONE_PARAMS)
    expect(res.status).toBe(204)
  })

  it('returns 404 for unknown zone (P2025)', async () => {
    const err = Object.assign(new Error('not found'), { code: 'P2025' })
    vi.mocked(prisma.zone.delete).mockRejectedValue(err)
    const res = await DELETE(new NextRequest('http://localhost'), ZONE_PARAMS)
    expect(res.status).toBe(404)
  })
})
