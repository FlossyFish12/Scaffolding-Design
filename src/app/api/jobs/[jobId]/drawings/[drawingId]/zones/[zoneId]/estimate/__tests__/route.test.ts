import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = vi.hoisted(() => {
  const estimateItem = { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn() }
  const zone = { findUnique: vi.fn(), update: vi.fn() }
  const template = { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() }

  return {
    zone,
    template,
    estimateItem,
    $transaction: vi.fn(async (callback) => {
      return callback({ estimateItem, zone, template })
    }),
  }
})
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/estimate-engine', () => ({
  generateEstimateItems: vi.fn(() => [
    { category: 'labour', description: 'Erect', quantity: 15, unit: 'hrs', unitManhours: 1.0 },
  ]),
}))

import { POST } from '../route'

type Params = { params: Promise<{ jobId: string; drawingId: string; zoneId: string }> }
const makeParams = (zoneId = 'z1'): Params => ({
  params: Promise.resolve({ jobId: 'j1', drawingId: 'd1', zoneId }),
})
const makeReq = (body?: unknown) =>
  new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : '{}',
  })

const ZONE = {
  id: 'z1',
  scaffoldType: 'independent',
  accessType: 'ground',
  loadingClass: 'light',
  heightM: 4,
  perimeterM: 20,
  areaM2: 25,
  estimateItems: [],
}

const TEMPLATE = {
  id: 'tpl-1',
  name: 'Standard Independent',
  scaffoldType: 'independent',
  accessTypes: JSON.stringify(['ground', 'elevated']),
  loadingClasses: JSON.stringify(['light', 'medium']),
  lineItems: [{ id: 'li-1', category: 'labour', description: 'Erect', formula: 'area_m2 * height_m * 0.15', unit: 'hrs' }],
}

const GENERATED_ITEMS = [{ id: 'ei-1', zoneId: 'z1', category: 'labour', description: 'Erect', quantity: 15, unit: 'hrs', unitManhours: 1.0, overridden: false }]

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.estimateItem.deleteMany.mockResolvedValue({ count: 0 })
  mockPrisma.estimateItem.createMany.mockResolvedValue({ count: 1 })
  mockPrisma.estimateItem.findMany.mockResolvedValue(GENERATED_ITEMS)
  mockPrisma.zone.update.mockResolvedValue({})
})

describe('POST /zones/[zoneId]/estimate', () => {
  it('auto-matches template and returns generated items with 200', async () => {
    mockPrisma.zone.findUnique.mockResolvedValue(ZONE)
    mockPrisma.template.findMany.mockResolvedValue([TEMPLATE])
    const res = await POST(makeReq(), makeParams())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(GENERATED_ITEMS)
  })

  it('uses provided templateId and returns 200', async () => {
    mockPrisma.zone.findUnique.mockResolvedValue(ZONE)
    mockPrisma.template.findUnique.mockResolvedValue(TEMPLATE)
    const res = await POST(makeReq({ templateId: 'tpl-1' }), makeParams())
    expect(res.status).toBe(200)
    expect(mockPrisma.template.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'tpl-1' } }))
  })

  it('returns 422 when no matching template found', async () => {
    mockPrisma.zone.findUnique.mockResolvedValue(ZONE)
    mockPrisma.template.findMany.mockResolvedValue([])
    const res = await POST(makeReq(), makeParams())
    expect(res.status).toBe(422)
  })

  it('returns 404 for unknown zone', async () => {
    mockPrisma.zone.findUnique.mockResolvedValue(null)
    const res = await POST(makeReq(), makeParams('unknown'))
    expect(res.status).toBe(404)
  })

  it('preserves overridden existing items', async () => {
    const overriddenItem = { id: 'ei-0', zoneId: 'z1', category: 'labour', description: 'Erect', quantity: 99, unit: 'hrs', unitManhours: 1.5, overridden: true }
    mockPrisma.zone.findUnique.mockResolvedValue({ ...ZONE, estimateItems: [overriddenItem] })
    mockPrisma.template.findMany.mockResolvedValue([TEMPLATE])
    await POST(makeReq(), makeParams())
    // Should only delete non-overridden items
    expect(mockPrisma.estimateItem.deleteMany).toHaveBeenCalledWith({ where: { zoneId: 'z1', overridden: false } })
    // Should not re-create item with same key as overridden one
    const createCall = mockPrisma.estimateItem.createMany.mock.calls[0][0]
    const descriptions = createCall.data.map((d: { description: string }) => d.description)
    expect(descriptions).not.toContain('Erect')
  })
})
