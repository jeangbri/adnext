import { PrismaClient } from '@prisma/client';
import { decrypt } from './src/lib/encryption';

const prisma = new PrismaClient();

async function main() {
    const id = '43ee99b0-83ae-40ab-bd06-7123928e9c1d';

    // Simulate what broadcast-runner does
    const campaign = await prisma.broadcastCampaign.findUnique({ where: { id }, include: { page: true } });
    if (!campaign) return console.log('No campaign');

    console.log('Campaign status:', campaign.status);

    const recipients = await prisma.broadcastRecipient.findMany({
        where: { campaignId: id, status: 'PENDING' },
        take: 5
    });

    console.log(`Found ${recipients.length} pending recipients.`);

    if (recipients.length === 0) return process.exit(0);

    const pageToken = decrypt(campaign.page.pageAccessToken);
    // console.log('Page Token:', !!pageToken);

    for (const recipient of recipients) {
        console.log(`Recipient ${recipient.id}: ${recipient.userPsid}`);
        // Can we send?
        const contact = await prisma.contact.findUnique({ where: { id: recipient.contactId! } });
        if (!contact) {
            console.log('No contact found');
            continue;
        }

        const diff = new Date().getTime() - contact.lastSeenAt.getTime();
        const policyResponse24h = diff <= 24 * 60 * 60 * 1000;
        console.log(`Last seen diff: ${diff} ms. policy: ${policyResponse24h}`);

        // Construct message
        let messagingType = "RESPONSE";
        let tag = undefined;
        let messageBody: any = {
            recipient: { id: recipient.userPsid },
            messaging_type: messagingType,
            tag: tag
        };

        const payload = campaign.payload as any;

        if (campaign.messageType === 'TEXT') {
            messageBody.message = { text: payload.text };
        } else if (campaign.messageType === 'BUTTON_TEMPLATE') {
            messageBody.message = {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "button",
                        text: payload.text,
                        buttons: payload.buttons
                    }
                }
            };
        }

        console.log('Payload Body:', JSON.stringify(messageBody));

        // try to send
        const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${pageToken}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messageBody)
        });
        const data = await res.json();
        console.log('Meta Response:', data);

        // break after 1 request
        break;
    }
}

main().catch(e => console.error(e)).finally(() => process.exit(0));
