import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: [
      { level: 'warn', emit: 'event' },
      { level: 'error', emit: 'event' },
    ],
  });

// Note: Prisma $on logging disabled for type safety
// Use DATABASE_URL query logging in development if needed

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('✅ Database ulanish muvaffaqiyatli');
  } catch (error) {
    logger.error('❌ Database ulanishda xato:', error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database ulanish yopildi');
}
