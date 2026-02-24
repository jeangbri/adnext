import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function simulate() {
    const rule = await prisma.automationRule.findFirst({
        where: { name: 'Welcome' },
        include: { actions: { orderBy: { order: 'asc' } } }
    });

    if (!rule) return;

    let timeNow = new Date('2026-02-23T12:00:00Z').getTime();

    console.log(`Simulation starting at: ${new Date(timeNow).toISOString()}`);

    for (let i = 0; i < rule.actions.length; i++) {
        const action = rule.actions[i];
        const delayToWait = action.delayMs || 0;

        if (delayToWait > 0) {
            timeNow += delayToWait;
            console.log(`Action ${i} (${action.type}) scheduled and executed at: ${new Date(timeNow).toISOString()} (+${delayToWait / 60000} mins)`);
        } else {
            console.log(`Action ${i} (${action.type}) executed immediately at: ${new Date(timeNow).toISOString()}`);
        }
    }
}

simulate().catch(console.error).finally(() => prisma.$disconnect());
