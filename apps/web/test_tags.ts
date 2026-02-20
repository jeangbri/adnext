import fs from 'fs';
const envStr = fs.readFileSync('.env', 'utf8');
envStr.split('\n').forEach(line => {
    if (line.includes('=')) {
        const [k, ...v] = line.split('=');
        if (k && v.length) {
            process.env[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
        }
    }
});

import { PrismaClient } from '@prisma/client';
import { decrypt } from './src/lib/encryption';

const prisma = new PrismaClient();

async function main() {
    const id = '43ee99b0-83ae-40ab-bd06-7123928e9c1d';
    const campaign = await prisma.broadcastCampaign.findUnique({ where: { id }, include: { page: true } });

    // Pegar uma falha pra testar
    const failedRecipient = await prisma.broadcastRecipient.findFirst({
        where: { campaignId: id, status: 'FAILED' },
        orderBy: { id: 'desc' }
    });

    if (!failedRecipient) {
        console.log("Sem destinatários com falha para testar.");
        return;
    }

    const pageToken = decrypt(campaign!.page.pageAccessToken);

    // Testing different tags
    const tagsToTest = ['POST_PURCHASE_UPDATE', 'CONFIRMED_EVENT_UPDATE', 'ACCOUNT_UPDATE', 'HUMAN_AGENT'];

    for (const tag of tagsToTest) {
        console.log(`Testing tag: ${tag}`);
        const payload = campaign!.payload as any;

        let messageBody: any = {
            recipient: { id: failedRecipient.userPsid },
            messaging_type: "MESSAGE_TAG",
            tag: tag,
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

        const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${pageToken}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messageBody)
        });
        const data = await res.json();
        console.log(data);
        if (data.message_id) {
            console.log("✅ DEU CERTO COM A TAG:", tag);
            break;
        }
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
