import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const id = '43ee99b0-83ae-40ab-bd06-7123928e9c1d';

    // Atualiza todos os recipientes restantes para CANCELED ou SKIPPED pra travar
    const result = await prisma.broadcastRecipient.updateMany({
        where: { campaignId: id, status: 'PENDING' },
        data: { status: 'SKIPPED', skipReason: 'CANCELED_BY_USER' }
    });

    await prisma.broadcastCampaign.update({
        where: { id },
        data: { status: 'COMPLETED' }
    });

    console.log(`Cancelamento Concluído! ${result.count} envios pendentes foram abortados.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
