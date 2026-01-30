import { prisma } from "./prisma";
import { decrypt, encrypt } from "./encryption";

const FB_API_URL = "https://graph.facebook.com/v19.0";

// ------------------------------------------------------------------
// TYPES & INTERFACES
// ------------------------------------------------------------------

interface MessengerEvent {
    sender: { id: string };
    recipient: { id: string };
    timestamp: number;
    message?: {
        mid: string;
        text?: string;
        is_echo?: boolean;
        quick_reply?: { payload: string };
        attachments?: any[];
    };
    postback?: {
        mid: string; // sometimes present or not
        title: string;
        payload: string;
    };
}

// ------------------------------------------------------------------
// MAIN ENTRY POINT
// ------------------------------------------------------------------

export async function processMessengerEvent(body: any) {
    const object = body.object;
    if (object !== "page") return;

    for (const entry of body.entry) {
        const pageId = entry.id; // The Page ID

        if (entry.messaging) {
            for (const event of entry.messaging) {
                await handleMessagingEvent(pageId, event);
            }
        }
    }
}

async function handleMessagingEvent(pageId: string, event: MessengerEvent) {
    const senderId = event.sender.id;

    // 1. Deduplication (Check MID)
    const mid = event.message?.mid || (event.postback as any)?.mid;
    if (mid) {
        // Check if we already processed this MID in the last 2 minutes
        // Meta retries usually happen within seconds, but we check 2 mins to be safe.
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

        const recentLogs = await prisma.messageLog.findMany({
            where: {
                pageId: pageId,
                direction: 'IN',
                createdAt: { gte: twoMinutesAgo },
            },
            select: { rawEvent: true },
            take: 50,
            orderBy: { createdAt: 'desc' }
        });

        const isDuplicate = recentLogs.some(log => {
            const evt = log.rawEvent as any;
            const msgMid = evt?.message?.mid;
            const pbMid = evt?.postback?.mid;
            return msgMid === mid || pbMid === mid;
        });

        if (isDuplicate) {
            console.log(`[Deduplication] Skipping duplicate MID: ${mid}`);
            return;
        }
    }

    // 2. Ignore Echoes (Self-sent messages)
    if (event.message?.is_echo) return;

    // 3. Find Page
    const page = await prisma.messengerPage.findUnique({
        where: { pageId: pageId },
        include: { workspace: true }
    });

    if (!page || !page.isActive) {
        // If page is not in DB or inactive, ignore
        return;
    }

    // 4. Upsert Contact
    const contact = await upsertContact(page, senderId);

    // 5. Determine Input Text (Text message or Postback payload)
    let inputText = "";
    if (event.message?.quick_reply) {
        inputText = event.message.quick_reply.payload;
    } else if (event.message?.text) {
        inputText = event.message.text;
    } else if (event.postback?.payload) {
        inputText = event.postback.payload;
    }

    // If no text (e.g. image only), we might still want to log but maybe not match rules yet
    // unless we have "any" triggers.

    // 6. Log Incoming Message
    const logEntry = await prisma.messageLog.create({
        data: {
            pageId: page.pageId,
            contactId: contact.id,
            direction: 'IN',
            status: 'RECEIVED',
            incomingText: inputText || "[Non-text event]",
            rawEvent: event as any
        }
    });

    if (!inputText) return; // Nothing to match for now

    // 7. Match Engine
    await matchAndExecute(page, contact, inputText, logEntry.id);
}

// ------------------------------------------------------------------
// ENGINE: MATCHING & EXECUTION
// ------------------------------------------------------------------

async function matchAndExecute(page: any, contact: any, text: string, incomingLogId: string) {
    // 1. Fetch Active Rules for this Workspace
    const rules = await prisma.automationRule.findMany({
        where: {
            workspaceId: page.workspaceId,
            isActive: true
        },
        orderBy: [
            { priority: 'desc' },
            { createdAt: 'asc' } // Oldest first as tiebreaker? Or newest? Usually priority decides.
        ],
        include: {
            actions: {
                orderBy: { order: 'asc' }
            }
        }
    });

    let matchedRule: any = null;

    // 2. Evaluate Rules
    for (const rule of rules) {
        if (checkMatch(rule, text)) {
            // Check Cooldown
            if (rule.cooldownSeconds > 0) {
                const lastExec = await prisma.ruleExecution.findFirst({
                    where: {
                        ruleId: rule.id,
                        contactId: contact.id
                    },
                    orderBy: { lastExecutedAt: 'desc' }
                });

                if (lastExec) {
                    const elapsed = (new Date().getTime() - lastExec.lastExecutedAt.getTime()) / 1000;
                    if (elapsed < rule.cooldownSeconds) {
                        console.log(`[Engine] Rule "${rule.name}" matched but in cooldown (${elapsed}s < ${rule.cooldownSeconds}s)`);
                        continue;
                    }
                }
            }

            matchedRule = rule;
            break; // Stop at first match (Priority wins)
        }
    }

    // 3. Execute Actions
    if (matchedRule) {
        console.log(`[Engine] Matched Rule: "${matchedRule.name}" for contact ${contact.psid}`);

        // Update Log
        await prisma.messageLog.update({
            where: { id: incomingLogId },
            data: {
                status: 'MATCHED',
                matchedRuleId: matchedRule.id
            }
        });

        // Register Execution
        await prisma.ruleExecution.create({
            data: {
                ruleId: matchedRule.id,
                contactId: contact.id,
                timesExecuted: 1 // Ideally increment if exists, but create is fine for log history
            }
        });

        // Run Actions
        for (const action of matchedRule.actions) {
            // Delay?
            if (action.delayMs > 0) {
                await new Promise(r => setTimeout(r, action.delayMs));
            }

            try {
                await sendAction(page, contact.psid, action, incomingLogId);
            } catch (error) {
                console.error(`[Engine] Action Failed:`, error);
                // Continue or break? Usually continue next actions unless critical
            }
        }
    } else {
        console.log(`[Engine] No match for text: "${text}"`);
        // Optional: Update log to SKIPPED
        await prisma.messageLog.update({
            where: { id: incomingLogId },
            data: { status: 'SKIPPED' }
        });
    }
}

function checkMatch(rule: any, text: string): boolean {
    const normalize = (s: string) => {
        let res = s;
        if (rule.normalizeAccents) {
            res = res.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        }
        if (!rule.caseSensitive) {
            res = res.toLowerCase();
        }
        return res.trim();
    };

    const input = normalize(text);
    const keywords = rule.keywords.map((k: string) => normalize(k));

    if (keywords.length === 0) return true; // Empty keywords = Match All? Or Match None? Usually safely ignored or specific type. Assuming MATCH ALL if specified.

    if (rule.matchOperator === 'ALL') {
        // All keywords must be present
        return keywords.every((k: string) => matchSingle(rule.matchType, input, k));
    } else {
        // ANY
        return keywords.some((k: string) => matchSingle(rule.matchType, input, k));
    }
}

function matchSingle(type: string, input: string, keyword: string): boolean {
    switch (type) {
        case 'EXACT':
            return input === keyword;
        case 'STARTS_WITH':
            return input.startsWith(keyword);
        case 'REGEX':
            try {
                return new RegExp(keyword, 'i').test(input);
            } catch (e) { return false; }
        case 'CONTAINS':
        default:
            return input.includes(keyword);
    }
}

// ------------------------------------------------------------------
// ACTIONS & SENDING
// ------------------------------------------------------------------

async function sendAction(page: any, psid: string, action: any, refLogId: string) {
    const payload = action.payload as any;
    let messageBody: any = { recipient: { id: psid } };
    let actionTypeLabel = action.type;

    switch (action.type) {
        case 'TEXT':
            messageBody.message = { text: payload.text };
            break;

        case 'BUTTON_TEMPLATE':
            messageBody.message = {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "button",
                        text: payload.text,
                        buttons: payload.buttons?.map((b: any) => ({
                            type: b.type || "web_url",
                            url: b.type === 'web_url' ? b.url : undefined,
                            title: b.title,
                            payload: b.type === 'postback' ? b.payload : undefined
                        }))
                    }
                }
            };
            break;

        case 'GENERIC_TEMPLATE':
            messageBody.message = {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "generic",
                        elements: [
                            {
                                title: payload.title,
                                subtitle: payload.subtitle,
                                image_url: payload.imageUrl,
                                buttons: payload.buttons?.map((b: any) => ({
                                    type: b.type || "web_url",
                                    url: b.type === 'web_url' ? b.url : undefined,
                                    title: b.title,
                                    payload: b.type === 'postback' ? b.payload : undefined
                                }))
                            }
                        ]
                    }
                }
            };
            break;

        case 'IMAGE':
        case 'AUDIO':
        case 'FILE':
            messageBody.message = {
                attachment: {
                    type: action.type.toLowerCase(),
                    payload: {
                        url: payload.url,
                        is_reusable: true
                    }
                }
            };
            break;

        case 'QUICK_REPLIES':
            messageBody.message = {
                text: payload.text,
                quick_replies: payload.replies?.map((r: any) => ({
                    content_type: "text",
                    title: r.title,
                    payload: r.payload || r.title
                }))
            };
            break;

        default:
            console.warn("Unknown action type", action.type);
            return;
    }

    // Call Graph API
    await sendGraphApi(page, messageBody, refLogId, actionTypeLabel);
}

async function sendGraphApi(page: any, body: any, refLogId: string, actionType: string) {
    const token = decrypt(page.pageAccessToken);
    const url = `${FB_API_URL}/me/messages?access_token=${token}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const respData = await res.json();
    const success = res.ok && !respData.error;

    // Log Output
    await prisma.messageLog.create({
        data: {
            pageId: page.pageId,
            contactId: undefined, // linked via ref? or can fetch contact
            // We can resolve contactId from body.recipient.id if strictly needed for FK
            direction: 'OUT',
            status: success ? 'SENT' : 'FAILED',
            actionType: actionType,
            error: success ? null : JSON.stringify(respData.error),
            rawResponse: respData,
            matchedRuleId: undefined // Could link to rule if we passed ruleId down
        }
    });

    if (!success) {
        throw new Error(JSON.stringify(respData.error));
    }
}

// ------------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------------

async function upsertContact(page: any, psid: string) {
    // Check if exists
    let contact = await prisma.contact.findUnique({
        where: { workspaceId_psid: { workspaceId: page.workspaceId, psid } }
    });

    // If exists, just update last seen
    if (contact) {
        return prisma.contact.update({
            where: { id: contact.id },
            data: { lastSeenAt: new Date() }
        });
    }

    // Fetch Profile from Graph
    let profile: any = {};
    try {
        const token = decrypt(page.pageAccessToken);
        const url = `${FB_API_URL}/${psid}?fields=first_name,last_name,profile_pic&access_token=${token}`;
        const res = await fetch(url);
        if (res.ok) {
            profile = await res.json();
        }
    } catch (e) {
        console.error("Failed to fetch profile", e);
    }

    // Create
    return prisma.contact.create({
        data: {
            workspaceId: page.workspaceId,
            psid: psid,
            firstName: profile.first_name || "Unknown",
            lastName: profile.last_name || "",
            profilePicUrl: profile.profile_pic || "",
            lastSeenAt: new Date()
        }
    });
}

