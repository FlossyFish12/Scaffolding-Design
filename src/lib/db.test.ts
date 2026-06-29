import { describe, it, expect, vi } from 'vitest'

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(function () { return { $connect: vi.fn() } }),
}))

describe('db singleton', () => {
  it('exports a prisma instance', async () => {
    const { prisma } = await import('./db')
    expect(prisma).toBeDefined()
  })
})
