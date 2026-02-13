
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { classifyMessageType, MessagePolicyType } from "./messenger-policy";

// Helper to check 24h window
function isWithin24h(lastMessageAt: Date) {
    const diff = new Date().getTime() - lastMessageAt.getTime();
    return diff <= 24 * 60 * 60 * 1000;
}

/**
 * Core logic to process broadcast campaigns.
 * Can be called by Cron (GET) or Trigger (POST).
 */
export async function processBroadcasts() {
    // 1. Fetch campaigns that need processing
    // Status: SCHEDULED (needs audience gen + start) OR SENDING (needs continuation)
    // ScheduledAt <= now
    const now = new Date();

    const campaigns = await prisma.broadcastCampaign.findMany({
        where: {
            OR: [
                { status: 'SCHEDULED', scheduledAt: { lte: now } },
                { status: 'SENDING' }
            ]
        },
        take: 5, // Process few campaigns at a time
        include: { page: true }
    });

    if (campaigns.length === 0) {
        return { processed: 0, status: 'idle' };
    }

    let processedCount = 0;

    for (const campaign of campaigns) {
        try {
            // STEP A: Generate Audience if just starting
            // If status is SCHEDULED, we create Recipients then move to SENDING
            if (campaign.status === 'SCHEDULED') {
                console.log(`[Runner] Generating audience for campaign ${campaign.id}`);

                // Fetch Audience
                let userFilter: any = {
                    workspaceId: campaign.workspaceId,
                    pageId: campaign.pageId
                };

                const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                if (campaign.audienceType === 'ACTIVE_24H') {
                    // Filter contacts who have lastMessageAt within 24h
                    // NOTE: 'lastMessageAt' on Contact model should be updated whenever we receive a message
                    // If we rely on stored data, ensure we have it. 
                    // Fallback: if lastMessageAt is null, look at lastSeenAt? Schema has lastSeenAt.
                    // The schema has `lastSeenAt`. Let's use that.
                    userFilter.lastSeenAt = { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) };
                } else if (campaign.audienceType === 'ACTIVE_7D') {
                    userFilter.lastSeenAt = { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
                } else if (campaign.audienceType === 'NEW_TODAY') {
                    userFilter.firstSeenAt = { gte: startOfDay };
                }
                // 'ALL' has no extra filter

                const contacts = await prisma.contact.findMany({
                    where: userFilter,
                    select: { id: true, psid: true }
                });

                // Bulk Insert Reciplients
                if (contacts.length > 0) {
                    await prisma.broadcastRecipient.createMany({
                        data: contacts.map(c => ({
                            campaignId: campaign.id,
                            workspaceId: campaign.workspaceId,
                            pageId: campaign.pageId,
                            userPsid: c.psid,
                            contactId: c.id,
                            status: 'PENDING'
                        })),
                        skipDuplicates: true
                    });
                }

                // Update Campaign
                await prisma.broadcastCampaign.update({
                    where: { id: campaign.id },
                    data: {
                        status: 'SENDING',
                        totalRecipients: contacts.length
                    }
                });
            }

            // STEP B: Process Batch (SENDING)
            const recipients = await prisma.broadcastRecipient.findMany({
                where: { campaignId: campaign.id, status: 'PENDING' },
                take: 50 // Batch size
            });

            if (recipients.length === 0) {
                // Done? Check if any pending left (maybe we took 50 but there are 0 left actually)
                // If 0 returned, campaign is COMPLETED
                const totalPending = await prisma.broadcastRecipient.count({
                    where: { campaignId: campaign.id, status: 'PENDING' }
                });

                if (totalPending === 0) {
                    await prisma.broadcastCampaign.update({
                        where: { id: campaign.id },
                        data: { status: 'COMPLETED' }
                    });
                    // Counters update
                    const sent = await prisma.broadcastRecipient.count({ where: { campaignId: campaign.id, status: 'SENT' } });
                    const failed = await prisma.broadcastRecipient.count({ where: { campaignId: campaign.id, status: 'FAILED' } });
                    const skipped = await prisma.broadcastRecipient.count({ where: { campaignId: campaign.id, status: 'SKIPPED' } });

                    await prisma.broadcastCampaign.update({
                        where: { id: campaign.id },
                        data: { totalSent: sent, totalFailed: failed, totalSkipped: skipped }
                    });
                }
                continue; // Next campaign
            }

            // Send
            const pageToken = decrypt(campaign.page.pageAccessToken);

            for (const recipient of recipients) {
                let canSend = false;
                let skipReason = null;
                let messagingType = "RESPONSE";
                let tag = undefined;

                const contact = await prisma.contact.findUnique({ where: { id: recipient.contactId! } });

                if (!contact) {
                    await prisma.broadcastRecipient.update({
                        where: { id: recipient.id },
                        data: { status: 'FAILED', error: 'Contact not found' }
                    });
                    continue;
                }

                const policy = classifyMessageType({
                    lastInteractionAt: contact.lastSeenAt,
                    isBroadcast: true
                });

                if (policy === MessagePolicyType.RESPONSE_24H) {
                    canSend = true;
                } else if (policy === MessagePolicyType.UTILITY_TEMPLATE || policy === MessagePolicyType.FOLLOW_UP_TEMPLATE) {
                    // Outside 24h -> Smart Conversion
                    canSend = true;
                    messagingType = "MESSAGE_TAG";
                    tag = campaign.tag || "ACCOUNT_UPDATE"; // Default to ACCOUNT_UPDATE if no tag provided
                } else {
                    canSend = false;
                    skipReason = "BLOCKED_BY_POLICY";
                }

                if (!canSend) {
                    await prisma.broadcastRecipient.update({
                        where: { id: recipient.id },
                        data: { status: 'SKIPPED', skipReason }
                    });
                    continue;
                }

                // Call Meta
                try {
                    // Construct body based on campaign.messageType
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
                    } else if (campaign.messageType === 'AUDIO') {
                        messageBody.message = {
                            attachment: {
                                type: "audio",
                                payload: { url: payload.url }
                            }
                        };
                    }

                    const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${pageToken}`;
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(messageBody)
                    });
                    const data = await res.json();

                    if (res.ok) {
                        await prisma.broadcastRecipient.update({
                            where: { id: recipient.id },
                            data: {
                                status: 'SENT',
                                sentAt: new Date(),
                                metaMessageId: data.message_id
                            }
                        });

                        // Log to MessageLog (for charts)
                        await prisma.messageLog.create({
                            data: {
                                pageId: campaign.pageId,
                                contactId: contact.id,
                                campaignId: campaign.id,
                                direction: 'OUT',
                                status: 'SENT',
                                actionType: 'BROADCAST',
                                rawResponse: data
                            }
                        });
                        processedCount++;
                    } else {
                        await prisma.broadcastRecipient.update({
                            where: { id: recipient.id },
                            data: {
                                status: 'FAILED',
                                error: data.error?.message || 'Unknown graph error'
                            }
                        });
                        // Log Error
                        await prisma.messageLog.create({
                            data: {
                                pageId: campaign.pageId,
                                contactId: contact.id,
                                campaignId: campaign.id,
                                direction: 'OUT',
                                status: 'FAILED',
                                actionType: 'BROADCAST',
                                error: data.error?.message
                            }
                        });
                    }

                } catch (e: any) {
                    await prisma.broadcastRecipient.update({
                        where: { id: recipient.id },
                        data: { status: 'FAILED', error: e.message }
                    });
                }
            } // end recipients loop

            // Update campaign stats roughly (optional, or wait for completion)
            const sent = await prisma.broadcastRecipient.count({ where: { campaignId: campaign.id, status: 'SENT' } });
            await prisma.broadcastCampaign.update({
                where: { id: campaign.id },
                data: { totalSent: sent } // Minimal update
            });

        } catch (err) {
            console.error(`[Runner] Error processing campaign ${campaign.id}`, err);
        }
    }

    return { processed: processedCount, status: 'ok' };
}
