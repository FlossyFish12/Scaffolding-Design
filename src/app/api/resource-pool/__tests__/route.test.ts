import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'

const { mockPrisma } = vi.hoisted(() => {
  const resourcePool = {
    findMany: vi.fn(),
    upsert: vi.fn(),
  }
  const mockPrisma = { resourcePool }
  return { mockPrisma }
})

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockEntry = {
  id: 'rp-1',
  weekStartDate: new Date('2026-07-06'),
  availableManhours: 400,
}

beforeEach(() => vi.clearAllMocks())

// ── GET /api/resource-pool ────────────────────────────────────────────────────

describe('GET /api/resource-pool', () => {
  it('returns entries in date range', async () => {
    const { GET } = await import('../route')
    mockPrisma.resourcePool.findMany.mockResolvedValue([mockEntry])
    const res = await GET(
      new Request('http://localhost/api/resource-pool?from=2026-07-01T00:00:00.000Z&to=2026-09-30T00:00:00.000Z'),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('rp-1')
  })

  it('returns 400 when from or to is missing', async () => {
    const { GET } = await import('../route')
    const res = await GET(new Request('http://localhost/api/resource-pool'))
    expect(res.status).toBe(400)
  })
})

// ── PUT /api/resource-pool ────────────────────────────────────────────────────

describe('PUT /api/resource-pool', () => {
  it('upserts entry and returns it', async () => {
    const { PUT } = await import('../route')
    mockPrisma.resourcePool.upsert.mockResolvedValue(mockEntry)
    const res = await PUT(
      new Request('http://localhost/api/resource-pool', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStartDate: '2026-07-06T00:00:00.000Z', availableManhours: 400 }),
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('rp-1')
  })

  it('returns 400 for invalid body', async () => {
    const { PUT } = await import('../route')
    const res = await PUT(
      new Request('http://localhost/api/resource-pool', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStartDate: 'not-a-date', availableManhours: -1 }),
      }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for malformed JSON', async () => {
    const { PUT } = await import('../route')
    const res = await PUT(
      new Request('http://localhost/api/resource-pool', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
    )
    expect(res.status).toBe(400)
  })
})
