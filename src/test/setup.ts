import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Prisma runtime library for testing
class PrismaClientKnownRequestError extends Error {
  code: string
  clientVersion: string
  constructor(message: string, { code, clientVersion }: { code: string; clientVersion: string }) {
    super(message)
    this.code = code
    this.clientVersion = clientVersion
  }
}

vi.mock('@prisma/client/runtime/library', () => ({
  PrismaClientKnownRequestError,
}))
