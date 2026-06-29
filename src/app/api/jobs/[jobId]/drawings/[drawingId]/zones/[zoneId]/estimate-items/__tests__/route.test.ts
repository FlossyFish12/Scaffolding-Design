import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  estimateItem: {
    update: vi.fn(),
  },
}))
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

import { PATCH } from '../[itemId]/route'

type Params = { params: Promise<{ jobId: string; drawingId: string; zoneId: string; itemId: string }> }
const makeParams = (itemId = 'ei-1'): Params => ({
  params: Promise.resolve({ jobId: 'j1', drawingId: 'd1', zoneId: 'z1', itemId }),
})
const makeReq = (body: unknown) =>
  new Request('http://localhost', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

beforeEach(() => vi.clearAllMocks())

describe('PATCH /estimate-items/[itemId]', () => {
  it('overrides quantity and sets overridden=true', async () => {
    mockPrisma.estimateItem.update.mockResolvedValue({
      id: 'ei-1', quantity: 20, unitManhours: 1.0, overridden: true,
    })
    const res = await PATCH(makeReq({ quantity: 20 }), makeParams())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.overridden).toBe(true)
    expect(mockPrisma.estimateItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ quantity: 20, overridden: true }) })
    )
  })

  it('overrides unitManhours and sets overridden=true', async () => {
    mockPrisma.estimateItem.update.mockResolvedValue({
      id: 'ei-1', quantity: 15, unitManhours: 1.5, overridden: true,
    })
    const res = await PATCH(makeReq({ unitManhours: 1.5 }), makeParams())
    expect(res.status).toBe(200)
    expect(mockPrisma.estimateItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ unitManhours: 1.5, overridden: true }) })
    )
  })

  it('returns 400 when no fields provided', async () => {
    const res = await PATCH(makeReq({}), makeParams())
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new Request('http://localhost', { method: 'PATCH', body: 'bad', headers: { 'Content-Type': 'application/json' } })
    const res = await PATCH(req, makeParams())
    expect(res.status).toBe(400)
  })

  it('returns 404 for unknown item (P2025)', async () => {
    const { Prisma } = await import('@prisma/client')
    mockPrisma.estimateItem.update.mockRejectedValue(
      Object.assign(new Prisma.PrismaClientKnownRequestError('', { code: 'P2025', clientVersion: '' }), {})
    )
    const res = await PATCH(makeReq({ quantity: 5 }), makeParams('unknown'))
    expect(res.status).toBe(404)
  })
})
