import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  await prisma.infrastructureState.upsert({
    where: { key: 'phase1' },
    update: { value: 'core-infrastructure' },
    create: { key: 'phase1', value: 'core-infrastructure' },
  });
} finally {
  await prisma.$disconnect();
}
