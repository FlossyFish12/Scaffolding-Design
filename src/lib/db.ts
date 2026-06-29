import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createClient() {
  const url = process.env.DATABASE_URL
  if (url) {
    return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
  }
  // No DATABASE_URL in env — queries will throw but the module loads cleanly
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: 'postgresql://localhost/dev' }) })
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
