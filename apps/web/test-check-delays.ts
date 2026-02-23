import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const rules = await prisma.automationRule.findMany({
        where: { actions: { some: { delayMs: { gt: 0 } } } },
        select: {
            id: true,
            name: true,
            actions: {
                orderBy: { order: 'asc' },
                select: { id: true, type: true, delayMs: true, order: true }
            }
        }
    });
    console.log(JSON.stringify(rules, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
