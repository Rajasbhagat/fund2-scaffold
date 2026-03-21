import { prisma } from '../src/lib/prisma'

async function main() {
  await prisma.appSettings.upsert({
    where: { id: 1 },
    create: { id: 1, sessionNumber: 1 },
    update: {},
  })
  console.log('AppSettings seeded')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
