import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const id = '43ee99b0-83ae-40ab-bd06-7123928e9c1d';

    // Contar recipients reais na tabela BroadcastRecipient pra ter certeza
    const countTotal = await prisma.broadcastRecipient.count({ where: { campaignId: id } });
    const countPending = await prisma.broadcastRecipient.count({ where: { campaignId: id, status: 'PENDING' } });
    const countSent = await prisma.broadcastRecipient.count({ where: { campaignId: id, status: 'SENT' } });
    const countFailed = await prisma.broadcastRecipient.count({ where: { campaignId: id, status: 'FAILED' } });
    const countSkipped = await prisma.broadcastRecipient.count({ where: { campaignId: id, status: 'SKIPPED' } });
    const status = await prisma.broadcastCampaign.findUnique({ where: { id }, select: { status: true, audienceType: true } });

    console.log('\n--- Status Atual ---');
    console.log(status);
    console.log(`Total Recipients na Fila: ${countTotal}`);
    console.log(`Pending: ${countPending}`);
    console.log(`Sent: ${countSent}`);
    console.log(`Failed: ${countFailed}`);
    console.log(`Skipped: ${countSkipped}`);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
