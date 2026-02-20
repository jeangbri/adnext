process.env.APP_ENCRYPTION_KEY = '12345678901234567890123456789012';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const pageId = "978744651987190";

async function main() {
    const { decrypt } = await import('./src/lib/encryption');

    console.log("Iniciando envio massivo V2 (UTILITY) via Tag ACCOUNT_UPDATE...");

    // 1. Pegar o template
    const template = await prisma.messengerTemplate.findFirst({
        where: { name: 'Aviso de Atualização - Status da Conta' }
    });
    if (!template) throw new Error("Template STRICT não encontrado!");

    // 2. Cancelar o envio antigo no broadcast v1
    await prisma.broadcastRecipient.updateMany({
        where: { campaignId: "43ee99b0-83ae-40ab-bd06-7123928e9c1d", status: 'PENDING' },
        data: { status: 'SKIPPED' } // skipped
    });
    await prisma.broadcastCampaign.update({
        where: { id: "43ee99b0-83ae-40ab-bd06-7123928e9c1d" },
        data: { status: 'COMPLETED' }
    });
    console.log("Campanha antiga v1 (43ee) cancelada com sucesso!");

    // 3. Criar Job V2 Representativo
    const job = await prisma.broadcastJobV2.create({
        data: {
            pageId,
            policyType: 'UTILITY',
            templateId: template.id,
            status: 'PROCESSING',
            scheduledAt: new Date(),
            payload: { context: "Massive Migration" }
        }
    });

    // 4. Pegar credenciais da página
    const page = await prisma.messengerPage.findUnique({ where: { pageId } });
    if (!page) throw new Error("Página não encontrada!");

    const pageToken = decrypt(page.pageAccessToken);

    // 5. Pegar todos os contatos da pagina
    const contacts = await prisma.contact.findMany({
        where: { pageId }
    });
    console.log(`Total de contatos a processar: ${contacts.length}`);

    let sent = 0;
    let failed = 0;

    const payload = template.contentJson as any;

    for (const c of contacts) {
        let messageBody: any = {
            recipient: { id: c.psid },
            messaging_type: "MESSAGE_TAG",
            tag: "ACCOUNT_UPDATE",
            message: {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "button",
                        text: payload.text,
                        buttons: payload.buttons
                    }
                }
            }
        };

        try {
            const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${pageToken}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(messageBody)
            });
            const data = await res.json();

            if (res.ok) {
                sent++;
                await prisma.broadcastLogV2.create({
                    data: {
                        jobId: job.id,
                        userPsid: c.psid,
                        templateId: template.id,
                        messageCategory: 'UTILITY',
                        lastInteractionAt: c.lastSeenAt,
                        status: 'SENT',
                        metaResponse: data
                    }
                });
            } else {
                failed++;
                await prisma.broadcastLogV2.create({
                    data: {
                        jobId: job.id,
                        userPsid: c.psid,
                        templateId: template.id,
                        messageCategory: 'UTILITY',
                        lastInteractionAt: c.lastSeenAt,
                        status: 'BLOCKED',
                        metaResponse: data
                    }
                });
            }
        } catch (e: any) {
            failed++;
        }
    }

    // Finalizar JOB
    await prisma.broadcastJobV2.update({
        where: { id: job.id },
        data: { status: 'COMPLETED' }
    });
    console.log(`====== CONCLUSÃO DO BROADCAST V2 ======`);
    console.log(`✅ ENVIADOS: ${sent}`);
    console.log(`❌ FALHADOS/BLOQUEADOS: ${failed}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
