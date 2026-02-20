import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    const id = '43ee99b0-83ae-40ab-bd06-7123928e9c1d';

    // If there's any errors recent, let's see the logs
    const errorLogs = await prisma.messageLog.findMany({
        where: { campaignId: id, status: 'FAILED' },
        take: 3,
        orderBy: { createdAt: 'desc' }
    });

    let out = "Log de Erros:\n";
    if (errorLogs.length > 0) {
        errorLogs.forEach(l => {
            out += `Erro: ${l.error}\n`;
            out += `Raw: ${JSON.stringify(l.rawResponse)}\n`;
        });
    }

    const campaign = await prisma.broadcastCampaign.findUnique({ where: { id } });
    out += `\nStatus Db Inicial: ${campaign?.status}\n`;

    const countTotal = await prisma.broadcastRecipient.count({ where: { campaignId: id } });
    const countSent = await prisma.broadcastRecipient.count({ where: { campaignId: id, status: 'SENT' } });
    const countFailed = await prisma.broadcastRecipient.count({ where: { campaignId: id, status: 'FAILED' } });
    const countSkipped = await prisma.broadcastRecipient.count({ where: { campaignId: id, status: 'SKIPPED' } });
    const countPending = await prisma.broadcastRecipient.count({ where: { campaignId: id, status: 'PENDING' } });

    out += `Total Recipients na Fila de DB: ${countTotal}\n`;
    out += `Pendentes: ${countPending}\n`;
    out += `Enviados: ${countSent}\n`;
    out += `Falhas: ${countFailed}\n`;
    out += `Pulados: ${countSkipped}\n`;

    fs.writeFileSync('db2_log.txt', out, 'utf8');
}

main().catch(console.error).finally(() => prisma.$disconnect());
