/**
 * Seed templates — idempotent. Run: npx tsx prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./prisma/dev.db' }) })

const TEMPLATES = [
  {
    name: 'Standard Independent',
    scaffoldType: 'independent' as const,
    accessTypes: JSON.stringify(['ground', 'elevated']),
    loadingClasses: JSON.stringify(['light', 'medium']),
    lineItems: {
      create: [
        { category: 'labour' as const, description: 'Erect & dismantle', formula: 'area_m2 * height_m * 0.15', unit: 'hrs' },
        { category: 'material' as const, description: 'Tube 48.3mm (m)', formula: 'perimeter_m * height_m * 0.8', unit: 'lm' },
      ],
    },
  },
  {
    name: 'Tank Birdcage Heavy',
    scaffoldType: 'birdcage' as const,
    accessTypes: JSON.stringify(['ground', 'confined']),
    loadingClasses: JSON.stringify(['heavy']),
    lineItems: {
      create: [
        { category: 'labour' as const, description: 'Birdcage erect & dismantle', formula: 'perimeter_m * height_m * 0.22', unit: 'hrs' },
        { category: 'material' as const, description: 'Tube 48.3mm (m)', formula: 'perimeter_m * height_m * 1.2', unit: 'lm' },
      ],
    },
  },
]

async function main() {
  for (const t of TEMPLATES) {
    const existing = await prisma.template.findFirst({ where: { name: t.name } })
    if (!existing) {
      await prisma.template.create({ data: t })
      console.log(`seeded template: ${t.name}`)
    } else {
      console.log(`exists: ${t.name}`)
    }
  }
}

main().finally(() => prisma.$disconnect())
