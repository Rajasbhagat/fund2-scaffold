export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { prisma } = await import('./lib/prisma')
    await prisma.$executeRawUnsafe('PRAGMA journal_mode=WAL')
  }
}
