import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  prisma: {
    job: { findUnique: vi.fn() },
    drawing: { create: vi.fn(), findMany: vi.fn() },
  },
}))

vi.mock('@vercel/blob', () => ({
  put: vi.fn().mockResolvedValue({ url: 'https://blob.example.com/test.pdf' }),
}))

import { POST } from './route'
import { prisma } from '@/lib/db'

describe('POST /api/jobs/[jobId]/drawings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a drawing record and returns 201', async () => {
    const mockDrawing = {
      id: 'd1', jobId: 'j1', structureId: 'STR-01',
      structureName: 'Tank A', filename: 'ga.pdf',
      blobUrl: 'https://blob.example.com/test.pdf', pageCount: 1,
    }
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'j1' } as any)
    vi.mocked(prisma.drawing.create).mockResolvedValue(mockDrawing as any)

    const formData = new FormData()
    formData.append('file', new Blob(['%PDF'], { type: 'application/pdf' }), 'ga.pdf')
    formData.append('structureId', 'STR-01')
    formData.append('structureName', 'Tank A')

    const request = new NextRequest('http://localhost/api/jobs/j1/drawings', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request, { params: Promise.resolve({ jobId: 'j1' }) })
    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.structureId).toBe('STR-01')
  })

  it('returns 400 when file is missing', async () => {
    const formData = new FormData()
    formData.append('structureId', 'STR-01')
    formData.append('structureName', 'Tank A')

    const request = new NextRequest('http://localhost/api/jobs/j1/drawings', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request, { params: Promise.resolve({ jobId: 'j1' }) })
    expect(response.status).toBe(400)
  })
})
