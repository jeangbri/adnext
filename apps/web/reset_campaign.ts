import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const id = '43ee99b0-83ae-40ab-bd06-7123928e9c1d';

    // 1. Excluir os recipients antigos para que a audiência seja gerada do zero novamente
    console.log('Removendo destinatários antigos...');
    await prisma.broadcastRecipient.deleteMany({
        where: { campaignId: id }
    });

    // 2. Zerar a campanha, configurar para 24h e colocar como agendada para AGORA
    console.log('Atualizando a campanha para reenvio dentro de 24h...');
    await prisma.broadcastCampaign.update({
        where: { id },
        data: {
            audienceType: 'ACTIVE_24H',
            policyMode: '24H_ONLY',
            status: 'SCHEDULED', // Para que o runner pegue de novo
            scheduledAt: new Date(), // Enviar agora
            totalRecipients: 0,
            totalSent: 0,
            totalFailed: 0,
            totalSkipped: 0
        }
    });

    console.log('✅ Campanha configurada para 24H_ONLY e reescalada com sucesso!');

    // 3. Informações sobre quantos contatos temos nas 24h baseando-nos nos mesmos filtros
    const campaign = await prisma.broadcastCampaign.findUnique({ where: { id } });
    const now = new Date();
    const count24h = await prisma.contact.count({
        where: {
            workspaceId: campaign?.workspaceId,
            pageId: campaign?.pageId,
            lastSeenAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
        }
    });

    console.log(`Pessoas ativas nas últimas 24h para esta página: ${count24h}`);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
