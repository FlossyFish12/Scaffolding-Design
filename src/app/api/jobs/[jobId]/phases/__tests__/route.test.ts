import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'

const { mockPrisma, PrismaClientKnownRequestError } = vi.hoisted(() => {
  class PrismaClientKnownRequestError extends Error {
    code: string
    clientVersion: string
    constructor(message: string, { code, clientVersion }: { code: string; clientVersion: string }) {
      super(message)
      this.code = code
      this.clientVersion = clientVersion
    }
  }

  const phase = {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
  const job = { findUnique: vi.fn() }
  const mockPrisma = { phase, job }
  return { mockPrisma, PrismaClientKnownRequestError }
})

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@prisma/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError,
  },
}))

const mockPhase = {
  id: 'phase-1',
  jobId: 'job-1',
  type: 'erect',
  structureId: 'S01',
  startDate: new Date('2026-07-01'),
  endDate: new Date('2026-07-28'),
  manhoursTotal: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.job.findUnique.mockResolvedValue({ id: 'job-1' })
})

// ── GET /api/jobs/[jobId]/phases ──────────────────────────────────────────────

describe('GET /api/jobs/[jobId]/phases', () => {
  it('returns phase list ordered by startDate', async () => {
    const { GET } = await import('../route')
    mockPrisma.phase.findMany.mockResolvedValue([mockPhase])
    const res = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ jobId: 'job-1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('phase-1')
    expect(mockPrisma.phase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { jobId: 'job-1' } }),
    )
  })

  it('returns 404 when job not found', async () => {
    const { GET } = await import('../route')
    mockPrisma.job.findUnique.mockResolvedValue(null)
    const res = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ jobId: 'missing' }),
    })
    expect(res.status).toBe(404)
  })
})

// ── POST /api/jobs/[jobId]/phases ─────────────────────────────────────────────

describe('POST /api/jobs/[jobId]/phases', () => {
  it('creates phase and returns 201', async () => {
    const { POST } = await import('../route')
    mockPrisma.phase.create.mockResolvedValue(mockPhase)
    const body = {
      type: 'erect',
      structureId: 'S01',
      startDate: '2026-07-01T00:00:00.000Z',
      endDate: '2026-07-28T00:00:00.000Z',
    }
    const res = await POST(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ jobId: 'job-1' }) },
    )
    expect(res.status).toBe(201)
    const created = await res.json()
    expect(created.id).toBe('phase-1')
  })

  it('returns 400 for invalid type', async () => {
    const { POST } = await import('../route')
    const res = await POST(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'invalid', structureId: 'S01', startDate: '2026-07-01T00:00:00.000Z', endDate: '2026-07-28T00:00:00.000Z' }),
      }),
      { params: Promise.resolve({ jobId: 'job-1' }) },
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for malformed JSON', async () => {
    const { POST } = await import('../route')
    const res = await POST(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
      { params: Promise.resolve({ jobId: 'job-1' }) },
    )
    expect(res.status).toBe(400)
  })

  it('returns 404 when job not found', async () => {
    const { POST } = await import('../route')
    mockPrisma.job.findUnique.mockResolvedValue(null)
    const res = await POST(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'erect', structureId: 'S01', startDate: '2026-07-01T00:00:00.000Z', endDate: '2026-07-28T00:00:00.000Z' }),
      }),
      { params: Promise.resolve({ jobId: 'missing' }) },
    )
    expect(res.status).toBe(404)
  })
})

// ── PATCH /api/jobs/[jobId]/phases/[phaseId] ──────────────────────────────────

describe('PATCH /api/jobs/[jobId]/phases/[phaseId]', () => {
  it('updates phase and returns 200', async () => {
    const { PATCH } = await import('../[phaseId]/route')
    mockPrisma.phase.update.mockResolvedValue({ ...mockPhase, endDate: new Date('2026-08-04') })
    const res = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endDate: '2026-08-04T00:00:00.000Z' }),
      }),
      { params: Promise.resolve({ jobId: 'job-1', phaseId: 'phase-1' }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.endDate).toBeDefined()
  })

  it('returns 404 for unknown phase (P2025)', async () => {
    const { PATCH } = await import('../[phaseId]/route')
    mockPrisma.phase.update.mockRejectedValue(
      new PrismaClientKnownRequestError('not found', { code: 'P2025', clientVersion: '0' }),
    )
    const res = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'modify' }),
      }),
      { params: Promise.resolve({ jobId: 'job-1', phaseId: 'missing' }) },
    )
    expect(res.status).toBe(404)
  })
})

// ── DELETE /api/jobs/[jobId]/phases/[phaseId] ─────────────────────────────────

describe('DELETE /api/jobs/[jobId]/phases/[phaseId]', () => {
  it('deletes phase and returns 204', async () => {
    const { DELETE } = await import('../[phaseId]/route')
    mockPrisma.phase.delete.mockResolvedValue(mockPhase)
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ jobId: 'job-1', phaseId: 'phase-1' }),
    })
    expect(res.status).toBe(204)
  })

  it('returns 404 for unknown phase (P2025)', async () => {
    const { DELETE } = await import('../[phaseId]/route')
    mockPrisma.phase.delete.mockRejectedValue(
      new PrismaClientKnownRequestError('not found', { code: 'P2025', clientVersion: '0' }),
    )
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ jobId: 'job-1', phaseId: 'missing' }),
    })
    expect(res.status).toBe(404)
  })
})
