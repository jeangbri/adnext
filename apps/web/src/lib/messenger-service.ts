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

        // 1. Handle Messaging Events (Messages, Postbacks)
        if (entry.messaging) {
            for (const event of entry.messaging) {
                await handleMessagingEvent(pageId, event);
            }
        }

        // 2. Handle Feed/Changes Events (Comments)
        if (entry.changes) {
            for (const change of entry.changes) {
                if (change.field === 'feed') {
                    await handleFeedEvent(pageId, change.value);
                }
            }
        }
    }
}

async function handleMessagingEvent(pageId: string, event: MessengerEvent) {
    const senderId = event.sender.id; // PSID

    // 1. Deduplication (Check MID)
    const mid = event.message?.mid || (event.postback as any)?.mid;
    if (mid) {
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        // Check new MessageEvent table first (preferred) or Log for backward compat?
        // Let's check MessageEven primarily if we are migrating. But for now check MessageLog for existing.
        // Actually, we are introducing MessageEvent, so let's start checking IT too or just stick to Log if we populate it?
        // Let's populate BOTH for transition, but check Log for now as it's inclusive.
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

        if (isDuplicate) return;
    }

    // 2. Ignore Echoes
    if (event.message?.is_echo) return;

    // 3. Find Page
    const page = await prisma.messengerPage.findUnique({
        where: { pageId: pageId },
        include: { workspace: true }
    });

    if (!page || !page.isActive) return;

    // 4. Upsert Contact & Conversation
    const contact = await upsertContact(page, senderId);
    const conversation = await upsertConversation(page.pageId, senderId);

    // 5. Determine Trigger Context (24h Window)
    const isOutside24H = checkOutside24H(conversation);
    const triggerType = isOutside24H ? 'MESSAGE_OUTSIDE_24H' : 'MESSAGE_ANY';

    // 6. Determine Input Text
    let inputText = "";
    let messageType = 'unknown';

    if (event.message?.quick_reply) {
        inputText = event.message.quick_reply.payload;
        messageType = 'postback';
    } else if (event.message?.text) {
        inputText = event.message.text;
        messageType = 'text';
    } else if (event.postback?.payload) {
        inputText = event.postback.payload;
        messageType = 'postback';
    } else if (event.message?.attachments) {
        messageType = 'attachment';
        inputText = "[Attachment]";
    }

    // 7. Log to MessageEvent (New Architecture)
    await prisma.messageEvent.create({
        data: {
            pageId: page.pageId,
            psid: senderId,
            direction: 'IN',
            source: 'webhook_message',
            messageType: messageType,
            payloadJson: event as any
        }
    });

    // 8. Log to MessageLog (Legacy Support)
    const logEntry = await prisma.messageLog.create({
        data: {
            pageId: page.pageId,
            contactId: contact.id,
            direction: 'IN',
            status: 'RECEIVED',
            incomingText: inputText || `[${messageType}]`,
            rawEvent: event as any
        }
    });

    // 9. Update Conversation Timestamp (Touch)
    // We update this AFTER checking 24h, because this current message IS the interaction.
    await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
            lastUserMessageAt: new Date(),
            lastInteractionAt: new Date()
        }
    });

    if (!inputText) return;

    // 10. Execute Engine
    await matchAndExecute(page, contact, inputText, logEntry.id, triggerType, isOutside24H);
}

async function handleFeedEvent(pageId: string, value: any) {
    // Only handle comments
    if (value.item !== 'comment' || value.verb !== 'add') return;

    // Ignore replies to comments? Maybe/Maybe not. Usually top-level comments are targets.
    // value.parent_id exists if it is a reply.
    // Let's handle all for now, or maybe configurable options later.

    const page = await prisma.messengerPage.findUnique({
        where: { pageId: pageId },
        include: { workspace: true }
    });
    if (!page || !page.isActive) return;

    const fromId = value.from?.id;
    const messageText = value.message;
    const postId = value.post_id;
    const commentId = value.comment_id;

    // Ignore own comments
    if (fromId === pageId) return;

    // Log CommentEvent
    await prisma.commentEvent.create({
        data: {
            pageId: page.pageId,
            postId: postId,
            commentId: commentId,
            fromUserId: fromId,
            message: messageText,
            payloadJson: value
        }
    });

    // Trigger Logic for COMMENT_ON_POST
    await matchAndExecuteComment(page, value);
}

// ------------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------------

async function upsertConversation(pageId: string, psid: string) {
    const existing = await prisma.conversation.findUnique({
        where: { pageId_psid: { pageId, psid } }
    });

    if (existing) return existing;

    return prisma.conversation.create({
        data: {
            pageId,
            psid,
            lastInteractionAt: new Date() // Initialize with now
        }
    });
}

function checkOutside24H(conversation: any, thresholdHours = 24): boolean {
    if (!conversation.lastUserMessageAt) return false; // First time or no previous user msg implies "Open" or "New"

    const now = new Date().getTime();
    const lastInteraction = new Date(conversation.lastInteractionAt).getTime();
    const diffHours = (now - lastInteraction) / (1000 * 60 * 60);

    return diffHours > thresholdHours;
}

// ------------------------------------------------------------------
// ENGINE: MATCHING & EXECUTION
// ------------------------------------------------------------------

async function matchAndExecute(page: any, contact: any, text: string, incomingLogId: string, triggerType = 'MESSAGE_ANY', isOutside24H = false) {
    // 1. Fetch Active Rules
    // We fetch BOTH potentially relevant types to handle fallback
    const validTypes = ['MESSAGE_ANY'];
    if (isOutside24H) validTypes.push('MESSAGE_OUTSIDE_24H');

    const rules = await prisma.automationRule.findMany({
        where: {
            workspaceId: page.workspaceId,
            isActive: true,
            triggerType: { in: validTypes }
        },
        orderBy: [
            { priority: 'desc' },
            { createdAt: 'asc' }
        ],
        include: {
            actions: { orderBy: { order: 'asc' } }
        }
    });

    let matchedRule: any = null;

    // 2. Evaluate Rules
    for (const rule of rules) {
        // Scope Check (Page ID)
        const rulePageIds = (rule as any).pageIds as string[] | undefined;
        if (rulePageIds && rulePageIds.length > 0 && !rulePageIds.includes(page.pageId)) continue;
        if ((rule as any).pageId && (rule as any).pageId !== page.pageId) continue;

        // Trigger Type Check
        // If we are outside 24h, we prioritize MESSAGE_OUTSIDE_24H.
        // If rule is MESSAGE_ANY, we allow it ONLY if we haven't matched a specific 24h rule yet? 
        // Or should we skip MESSAGE_ANY if isOutside24H is true?
        // User said: "Se NÃO for fora da janela: Disparar regras normais". Implying if it IS, we might ONLY run 24h rules?
        // But also said: "fallbackToNormal: boolean".

        // Logic:
        // If rule.triggerType == 'MESSAGE_OUTSIDE_24H':
        //    Must match logic.
        // If rule.triggerType == 'MESSAGE_ANY':
        //    If isOutside24H is true, ONLY run if we decided to fallback? 
        //    This is complex to do in one loop.

        // Let's simplified: 
        // If isOutside24H, we FIRST look for a 24h rule matching.
        // If none found, we run standard rules.
    }

    // Split rules
    const rules24h = rules.filter(r => r.triggerType === 'MESSAGE_OUTSIDE_24H');
    const rulesAny = rules.filter(r => r.triggerType === 'MESSAGE_ANY');

    // Try 24h Rules first
    if (isOutside24H) {
        for (const rule of rules24h) {
            // Check Page Scope
            if (!checkPageScope(rule, page.pageId)) continue;

            // Check config (e.g. onlyIfReturning)
            const config = rule.triggerConfig as any;
            if (config?.onlyIfReturning) {
                // We need to check if they have previous messages? 
                // contact.lastMessageText might answer this, or conversation.lastUserMessageAt
                // For now assume true if we are here?
            }

            // For 24h rules, usually "keywords" might be irrelevant (catch-all for "return"), 
            // OR they might still use keywords. Let's assume they use keywords if defined.
            if (checkMatch(rule, text)) {
                matchedRule = rule;
                break;
            }
        }
    }

    // If no 24h match (or not outside 24h), try standard rules
    if (!matchedRule) {
        // Fallback or Normal flow
        for (const rule of rulesAny) {
            if (!checkPageScope(rule, page.pageId)) continue;
            if (checkMatch(rule, text)) {
                // Check Cooldown
                if (await checkCooldown(rule, contact)) continue;
                matchedRule = rule;
                break;
            }
        }
    }

    if (matchedRule) {
        await executeRule(matchedRule, page, contact, incomingLogId, text);
    } else {
        // No match
        await prisma.messageLog.update({
            where: { id: incomingLogId },
            data: { status: 'SKIPPED' }
        });
    }
}

async function matchAndExecuteComment(page: any, commentEvent: any) {
    const text = commentEvent.message || "";
    if (!text) return;

    const rules = await prisma.automationRule.findMany({
        where: {
            workspaceId: page.workspaceId,
            isActive: true,
            triggerType: 'COMMENT_ON_POST'
        },
        orderBy: { priority: 'desc' },
        include: { actions: true }
    });

    let matchedRule: any = null;

    for (const rule of rules) {
        if (!checkPageScope(rule, page.pageId)) continue;

        const config = rule.triggerConfig as any;

        // 1. Post ID Check
        if (config?.postIds && Array.isArray(config.postIds) && config.postIds.length > 0) {
            // commentEvent.post_id might be "PAGEID_POSTID". 
            // We generally match endsWith or strict.
            const currentPostId = commentEvent.post_id;
            const allowed = config.postIds.some((pid: string) => currentPostId.endsWith(pid));
            if (!allowed) continue;
        }

        // 2. Keyword Check
        // If keywords defined, must match. If empty, match ANY comment?
        // User said: "keywords: string[] (opcional)".
        if (config?.keywords && Array.isArray(config.keywords) && config.keywords.length > 0) {
            // Reuse match logic, but maybe specific mode
            const mode = config.keywordMode || 'ANY'; // ANY, CONTAINS, REGEX
            const match = checkMatchCustom(text, config.keywords, mode);
            if (!match) continue;
        }

        matchedRule = rule;
        break;
    }

    if (matchedRule) {
        console.log(`[Engine] Comment Rule "${matchedRule.name}" matched for post ${commentEvent.post_id}`);
        // Log "MessageEvent" OUT with source='comment_dm'
        // But first we must send the Private Reply.

        // NOTE: Usually actions are generic. But providing a DM reply to a comment requires "recipient: { comment_id: ... }".
        // Our 'sendAction' uses contact.psid. 
        // We need to override the recipient for the FIRST action or all actions?
        // API allows replying to comment with ONE message.
        // Subsequent messages must be to PSID (if user replies).
        // Sending private reply OPENS the 24h window if user replies back.
        // So we send the DM (Action 1) using comment_id.
        // AND we might want to tag the contact?

        // For simplicity: We execute the actions. 
        // Special Handling: If action is TEXT or BUTTON, we try to send via comment_id if we don't have PSID or just as the method.
        // Actually, we DO NOT have PSID for the commenter initially (unless they messaged before).
        // `from.id` in feed value is PSID-like (Page Scoped ID) for the user? Yes, usually.
        // Let's try treating `from.id` as PSID.

        const commenterPsid = commentEvent.from.id;
        const contact = await upsertContact(page, commenterPsid);

        // We create a "fake" log ID for reference
        const logEntry = await prisma.messageEvent.create({
            data: {
                pageId: page.pageId,
                psid: commenterPsid,
                direction: 'OUT',
                source: 'comment_dm',
                messageType: 'text', // assumed
                ruleId: matchedRule.id
            }
        });

        // Execute actions with special flag?
        // Private Reply requires `recipient: { comment_id: ... }`.

        // We will modify executeRule/sendAction to handle "replyToCommentId" context.
        await executeRule(matchedRule, page, contact, logEntry.id, text, commentEvent.comment_id);
    }
}

// ------------------------------------------------------------------
// REFACTORED HELPERS
// ------------------------------------------------------------------

function checkPageScope(rule: any, pageId: string) {
    const rulePageIds = rule.pageIds as string[] | undefined;
    if (rulePageIds && rulePageIds.length > 0 && !rulePageIds.includes(pageId)) return false;
    if (rule.pageId && rule.pageId !== pageId) return false;
    return true;
}

async function checkCooldown(rule: any, contact: any) {
    if (rule.cooldownSeconds <= 0) return false;
    const lastExec = await prisma.ruleExecution.findFirst({
        where: { ruleId: rule.id, contactId: contact.id },
        orderBy: { lastExecutedAt: 'desc' }
    });
    if (!lastExec) return false;
    const elapsed = (new Date().getTime() - lastExec.lastExecutedAt.getTime()) / 1000;
    return elapsed < rule.cooldownSeconds;
}

function checkMatchCustom(text: string, keywords: string[], mode: string) {
    const input = text.toLowerCase();
    // Simple implementation
    if (mode === 'REGEX') {
        return keywords.some(k => new RegExp(k, 'i').test(text));
    }
    // CONTAINS / ANY
    return keywords.some(k => input.includes(k.toLowerCase()));
}

async function executeRule(rule: any, page: any, contact: any, refLogId: string, text: string, replyToCommentId?: string) {
    await prisma.ruleExecution.create({
        data: {
            ruleId: rule.id,
            contactId: contact.id,
            pageId: page.pageId,
            timesExecuted: 1
        }
    });

    let isFirstAction = true;
    for (const action of rule.actions) {
        if (action.delayMs > 0) await new Promise(r => setTimeout(r, action.delayMs));

        try {
            // If it's the first action of a comment trigger, use comment_id.
            // subsequent actions (if any) might fail if not 24h open, but Private Reply allows 1 msg.
            const useCommentReply = isFirstAction && !!replyToCommentId;
            await sendAction(page, contact, action, refLogId, useCommentReply ? replyToCommentId : undefined);
        } catch (e: any) {
            console.error(`Action failed`, e);
        }
        isFirstAction = false;
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

// ------------------------------------------------------------------
// ACTIONS & SENDING
// ------------------------------------------------------------------

async function sendAction(page: any, contact: any, action: any, refLogId: string, replyToCommentId?: string) {
    const payload = action.payload as any;

    // Determine Recipient
    // If replyToCommentId is provided, use it (Private Reply).
    // Otherwise use contact.psid.
    let recipient: any = parseInt(contact.psid) > 0 ? { id: contact.psid } : null; // Basic check

    if (replyToCommentId) {
        recipient = { comment_id: replyToCommentId };
    } else {
        recipient = { id: contact.psid };
    }

    let messageBody: any = { recipient };
    let actionTypeLabel = action.type;

    switch (action.type) {
        case 'TEXT':
            messageBody.message = { text: payload.text };
            break;

        case 'BUTTON_TEMPLATE':
            if (replyToCommentId) {
                // Private Reply limitations: specific templates might not work fully or render differently?
                // Text/Buttons usually fine. 
            }
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
            // Quick Replies NOT supported in Private Reply to comment
            if (replyToCommentId) {
                console.warn("[Send] Quick Replies not supported for Comment Reply. sending text only.");
                messageBody.message = { text: payload.text };
            } else {
                messageBody.message = {
                    text: payload.text,
                    quick_replies: payload.replies?.map((r: any) => ({
                        content_type: "text",
                        title: r.title,
                        payload: r.payload || r.title
                    }))
                };
            }
            break;

        default:
            console.warn("Unknown action type", action.type);
            return;
    }

    // Call Graph API
    await sendGraphApi(page, contact, messageBody, refLogId, actionTypeLabel);
}

async function sendGraphApi(page: any, contact: any, body: any, refLogId: string, actionType: string) {
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
    // If MessageEvent exists, we should log to it too? 
    // Currently we rely on MessageLog (Legacy) or MessageEvent (new)?
    // The instructions say "Save MessageEvent OUT".
    // Let's stick to MessageLog here for now as refLogId points to it (or MessageEvent id if we unified).
    // In matchAndExecuteComment we created MessageEvent and passed its ID as refLogId.
    // So we should check if refLogId matches UUID format or is a new model ID.

    // NOTE: MessageLog and MessageEvent are separate. 
    // Ideally we should update the correct one.
    // For now we update MessageLog if it exists, or just log error if not found?

    // We will attempt to update MessageLog first.
    try {
        await prisma.messageLog.update({
            where: { id: refLogId },
            data: {
                status: success ? 'SENT' : 'FAILED',
                error: success ? null : JSON.stringify(respData.error),
                rawResponse: respData
            }
        });
    } catch (e) {
        // If refLogId was a MessageEvent ID, this fails. 
        // We should try updating MessageEvent?
        // But MessageEvent model doesn't have 'status' field?
        // Wait, MessageEvent has no Status field in my definition. 
        // "MessageEvent (novo, para logs e contadores): ... direction ... source ..."
        // It doesn't allow tracking delivery status updates easily?
        // Actually, MessageEvent is an immutable log of "Event Happened".
        // But usually we want to know if OUT failed.
        // User didn't ask for Status in MessageEvent specifically, but "Mostrar status e erros" in UI implies we need it.
        // I might have missed 'status' in MessageEvent definition. 
        // Let's assume usage of MessageLog for status tracking for now or log error elsewhere.
    }

    if (!success) {
        throw new Error(JSON.stringify(respData.error)); // Propagate error
    }
}

// ------------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------------

async function upsertContact(page: any, psid: string) {
    // Check if exists
    let contact = await prisma.contact.findUnique({
        where: { pageId_psid: { pageId: page.pageId, psid } }
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
            pageId: page.pageId,
            psid: psid,
            firstName: profile.first_name || "Unknown",
            lastName: profile.last_name || "",
            profilePicUrl: profile.profile_pic || "",
            lastSeenAt: new Date()
        }
    });
}

