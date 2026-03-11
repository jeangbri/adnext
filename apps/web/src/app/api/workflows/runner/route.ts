import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/workflows/runner
 * Cron job that fires the root message of every active Broadcast Flow
 * to contacts that haven't interacted in the last 24h.
 *
 * Called by Vercel Cron or manually. Protected by CRON_SECRET.
 *
 * Logic:
 * 1. Fetch all active Broadcast Flow root rules (isBroadcastFlow: true)
 * 2. For each root:
 *    a. Fetch contacts for the page that have an old/null lastUserMessageAt
 *    b. Send the MESSAGE_WITH_BUTTONS action via Facebook Graph API
 *    c. Log the send
 */
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const key = req.nextUrl.searchParams.get("key");

    const isAuthorized =
        !cronSecret || // If no secret set, allow (dev)
        (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
        (cronSecret && key === cronSecret);

    if (!isAuthorized) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const stats = { flows: 0, contacts: 0, sent: 0, failed: 0 };

    try {
        // 1. Fetch all active broadcast flow root rules
        const flowRoots = await prisma.automationRule.findMany({
            where: {
                isActive: true,
                triggerType: 'MESSAGE_OUTSIDE_24H',
                triggerConfig: { path: ['isBroadcastFlow'], equals: true }
            },
            include: {
                actions: { orderBy: { order: 'asc' } }
            }
        });

        stats.flows = flowRoots.length;
        console.log(`[BroadcastFlow Runner] Found ${flowRoots.length} active flows`);

        const THRESHOLD_HOURS = 24;
        const cutoffTime = new Date(Date.now() - THRESHOLD_HOURS * 60 * 60 * 1000);

        for (const rule of flowRoots) {
            // Get the page for this rule
            const pageId = (rule as any).pageId;
            if (!pageId) {
                console.warn(`[BroadcastFlow Runner] Flow ${rule.id} has no pageId, skipping`);
                continue;
            }

            const page = await prisma.messengerPage.findUnique({
                where: { pageId }
            });

            if (!page || !page.isActive) {
                console.warn(`[BroadcastFlow Runner] Page ${pageId} not found or inactive`);
                continue;
            }

            // Find the MESSAGE_WITH_BUTTONS action
            const action = rule.actions.find((a: any) => a.type === 'MESSAGE_WITH_BUTTONS');
            if (!action) {
                console.warn(`[BroadcastFlow Runner] Flow ${rule.id} has no MESSAGE_WITH_BUTTONS action`);
                continue;
            }

            const payload = action.payload as any;
            const message = payload?.message || '';
            const buttons = payload?.buttons || [];

            if (!message) continue;

            // Prevent infinite loop by checking RuleExecution within last 24h
            const recentExecutions = await prisma.ruleExecution.findMany({
                where: {
                    ruleId: rule.id,
                    lastExecutedAt: { gte: cutoffTime }
                },
                select: { contactId: true }
            });
            const recentlyExecutedContactIds = recentExecutions.map((e: any) => e.contactId);

            // Fetch contacts outside 24h window
            const contacts = await prisma.contact.findMany({
                where: {
                    pageId: pageId,
                    lastSeenAt: { lt: cutoffTime },
                    id: { notIn: recentlyExecutedContactIds }
                },
                take: 100 // Cap per run to avoid timeout
            });

            stats.contacts += contacts.length;
            console.log(`[BroadcastFlow Runner] Flow ${rule.name}: ${contacts.length} contacts to reach`);

            // Decrypt access token
            const { decrypt } = await import("@/lib/encryption");
            let accessToken: string;
            try {
                accessToken = decrypt(page.accessToken);
            } catch (e) {
                console.error(`[BroadcastFlow Runner] Failed to decrypt token for page ${pageId}`);
                continue;
            }

            // Send to each contact
            for (const contact of contacts) {
                try {
                    const personalized = message.replace(/\{\{first_name\}\}/g, contact.firstName || 'você');

                    // Build FB message payload with generic template or quick replies
                    let fbPayload: any;

                    if (buttons.length > 0) {
                        // Use generic template with buttons
                        fbPayload = {
                            recipient: { id: contact.psid },
                            message: {
                                attachment: {
                                    type: "template",
                                    payload: {
                                        template_type: "button",
                                        text: personalized,
                                        buttons: buttons.slice(0, 3).map((btn: any) => {
                                            if (btn.actionType === 'web_url' && btn.value) {
                                                return {
                                                    type: "web_url",
                                                    url: btn.value,
                                                    title: btn.label?.slice(0, 20) || 'Saiba mais'
                                                };
                                            }
                                            // Postback for flow_jump
                                            const targetRuleId = btn.value || btn.targetNodeId || '';
                                            return {
                                                type: "postback",
                                                title: btn.label?.slice(0, 20) || 'Responder',
                                                payload: `FLOW_JUMP::${targetRuleId}`
                                            };
                                        })
                                    }
                                }
                            },
                            messaging_type: "MESSAGE_TAG",
                            tag: "ACCOUNT_UPDATE"
                        };
                    } else {
                        // Plain text message
                        fbPayload = {
                            recipient: { id: contact.psid },
                            message: { text: personalized },
                            messaging_type: "MESSAGE_TAG",
                            tag: "ACCOUNT_UPDATE"
                        };
                    }

                    const fbRes = await fetch(
                        `https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(fbPayload)
                        }
                    );

                    if (fbRes.ok) {
                        stats.sent++;
                        // Log outgoing
                        await prisma.messageLog.create({
                            data: {
                                pageId: pageId,
                                contactId: contact.id,
                                direction: 'OUT',
                                status: 'SENT',
                                matchedRuleId: rule.id,
                                actionType: 'broadcast_flow'
                            }
                        });

                        // Prevent loops (Record execution so we don't send again < 24h)
                        await prisma.ruleExecution.create({
                            data: {
                                ruleId: rule.id,
                                contactId: contact.id,
                                pageId: pageId,
                                timesExecuted: 1
                            }
                        });
                    } else {
                        const errData = await fbRes.json();
                        console.error(`[BroadcastFlow Runner] FB API error for ${contact.psid}:`, errData);
                        stats.failed++;
                    }
                } catch (e) {
                    console.error(`[BroadcastFlow Runner] Failed to send to ${contact.psid}:`, e);
                    stats.failed++;
                }
            }
        }

        return NextResponse.json({ ok: true, stats });
    } catch (e: any) {
        console.error("[BroadcastFlow Runner] Fatal error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// Allow POST for Supabase pg_net cron calls
export async function POST(req: NextRequest) {
    return GET(req);
}
