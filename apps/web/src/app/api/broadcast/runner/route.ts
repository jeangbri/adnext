
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Helper to check 24h window
function isWithin24h(lastMessageAt: Date) {
    const diff = new Date().getTime() - lastMessageAt.getTime();
    return diff <= 24 * 60 * 60 * 1000;
}

export async function GET(req: NextRequest) {
    const key = req.nextUrl.searchParams.get("key");
    const authHeader = req.headers.get("authorization");

    // Allow if key matches RUNNER_SECRET OR if Auth header matches CRON_SECRET (Vercel standard)
    const isKeyValid = key === process.env.RUNNER_SECRET;
    const isCronValid = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;

    if (!isKeyValid && !isCronValid) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
        return NextResponse.json({ processed: 0, status: 'idle' });
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
                    userFilter.lastMessageAt = { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) };
                } else if (campaign.audienceType === 'ACTIVE_7D') {
                    userFilter.lastMessageAt = { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
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
                // Check Policy
                // Need lastMessageAt. Fetch contact? Or assumes we knew creation. 
                // We stored contactId. Let's optimize: fetch contact lastMessageAt with recipient? 
                // Creating many relation queries is slow. Better fetch contacts in bulk or just fetch individual here (50 is ok).

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

                const inside24h = isWithin24h(contact.lastSeenAt);

                if (campaign.policyMode === '24H_ONLY') {
                    if (inside24h) {
                        canSend = true;
                    } else {
                        canSend = false;
                        skipReason = "OUTSIDE_24H";
                    }
                } else {
                    // TAGGED
                    if (inside24h) {
                        canSend = true;
                    } else {
                        // Needs tag
                        if (campaign.tag) {
                            canSend = true;
                            messagingType = "MESSAGE_TAG";
                            tag = campaign.tag;
                        } else {
                            canSend = false;
                            skipReason = "OUTSIDE_24H_NO_TAG";
                        }
                    }
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

    return NextResponse.json({ processed: processedCount, status: 'ok' });
}
