import { PrismaClient } from '@prisma/client';

// Use globalThis to avoid hot-reload multiple instances in dev
const g = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = g.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  g.prisma = prisma;
}
