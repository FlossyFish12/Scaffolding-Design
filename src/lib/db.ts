import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createClient() {
  const url = process.env.DATABASE_URL || ''
  if (url.startsWith('postgresql')) {
    return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
  }
  // SQLite via driver adapter (Prisma 7 requires adapter for non-postgres)
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./prisma/dev.db' }) })
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
