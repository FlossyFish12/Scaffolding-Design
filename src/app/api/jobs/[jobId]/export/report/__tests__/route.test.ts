import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockFindUnique, mockFindMany } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    job: { findUnique: mockFindUnique },
    phase: { findMany: mockFindMany },
  },
}))

// Mock renderToBuffer so tests don't actually render a PDF
vi.mock('@react-pdf/renderer', () => ({
  renderToBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-pdf')),
  Document: ({ children }: { children: React.ReactNode }) => children,
  Page: ({ children }: { children: React.ReactNode }) => children,
  Text: ({ children }: { children: React.ReactNode }) => children,
  View: ({ children }: { children: React.ReactNode }) => children,
  StyleSheet: { create: (s: unknown) => s },
  Font: { register: vi.fn() },
}))

import { GET } from '../route'

const mockJob = {
  id: 'j1',
  projectNumber: 'PRJ-001',
  title: 'Test Job',
  client: 'Internal',
  startDate: new Date('2026-06-01'),
  drawings: [
    {
      structureId: 'STR-01',
      structureName: 'Main Structure',
      zones: [
        {
          id: 'z1',
          label: 'Zone A',
          scaffoldType: 'independent',
          estimateItems: [
            { id: 'i1', category: 'labour', description: 'Erect', quantity: 10, unit: 'hrs', unitManhours: 1.5, overridden: false },
          ],
        },
      ],
    },
  ],
  phases: [
    { id: 'p1', structureId: 'STR-01', type: 'erect', startDate: new Date('2026-06-01'), endDate: new Date('2026-06-28'), manhoursTotal: 0 },
  ],
}

describe('GET /api/jobs/[jobId]/export/report', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a PDF with correct headers', async () => {
    mockFindUnique.mockResolvedValue(mockJob)
    const res = await GET({} as Request, { params: Promise.resolve({ jobId: 'j1' }) })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toContain('attachment')
    expect(res.headers.get('Content-Disposition')).toContain('.pdf')
  })

  it('returns 404 when job is not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    const res = await GET({} as Request, { params: Promise.resolve({ jobId: 'missing' }) })
    expect(res.status).toBe(404)
  })

  it('calls renderToBuffer once', async () => {
    mockFindUnique.mockResolvedValue(mockJob)
    await GET({} as Request, { params: Promise.resolve({ jobId: 'j1' }) })
    const { renderToBuffer } = await import('@react-pdf/renderer')
    expect(renderToBuffer).toHaveBeenCalledTimes(1)
  })
})
