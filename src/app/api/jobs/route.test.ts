import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  prisma: {
    job: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { GET, POST } from './route'
import { prisma } from '@/lib/db'

describe('GET /api/jobs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns list of jobs with 200', async () => {
    const mockJobs = [{ id: '1', title: 'Test Job', projectNumber: 'PRJ-001' }]
    vi.mocked(prisma.job.findMany).mockResolvedValue(mockJobs as any)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(mockJobs)
  })
})

describe('POST /api/jobs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a job and returns 201', async () => {
    const mockJob = { id: '1', projectNumber: 'PRJ-001', title: 'Test', client: 'Ops', status: 'draft', startDate: new Date().toISOString(), durationWeeks: 4 }
    vi.mocked(prisma.job.create).mockResolvedValue(mockJob as any)

    const request = new NextRequest('http://localhost/api/jobs', {
      method: 'POST',
      body: JSON.stringify({ projectNumber: 'PRJ-001', title: 'Test', client: 'Ops', startDate: new Date().toISOString(), durationWeeks: 4 }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(201)
  })

  it('returns 400 for invalid data', async () => {
    const request = new NextRequest('http://localhost/api/jobs', {
      method: 'POST',
      body: JSON.stringify({ title: '' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })
})
