import { prisma } from "./prisma";
import { decrypt, encrypt } from "./encryption";
import { saveAndScheduleExecution, clearExecution } from "./scheduler";
import { v4 as uuidv4 } from "uuid";

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
// FLOW TYPES
// ------------------------------------------------------------------
interface FlowStep {
    id: string;
    type: string; // 'question'
    message: string;
    expectedType?: string;
    conditions: FlowCondition[];
    fallback?: { message: string };
    expirationSeconds?: number;
}
interface FlowCondition {
    match: string;
    nextStep?: string;
    actions?: any[];
}
interface FlowConfig {
    enabled: boolean;
    steps: FlowStep[];
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

    // Log CommentEvent (Defensive)
    try {
        if ((prisma as any).commentEvent) {
            await (prisma as any).commentEvent.create({
                data: {
                    pageId: page.pageId,
                    postId: postId,
                    commentId: commentId,
                    fromUserId: fromId,
                    message: messageText,
                    payloadJson: value
                }
            });
        }
    } catch (e) {
        console.error("Failed to log comment event (Prisma model missing?)", e);
    }

    // Trigger Logic for COMMENT_ON_POST
    await matchAndExecuteComment(page, {
        message: messageText,
        post_id: postId,
        comment_id: commentId,
        from: { id: fromId }
    });
}

// ------------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------------

async function upsertConversation(pageId: string, psid: string) {
    try {
        if (!(prisma as any).conversation) return { lastUserMessageAt: new Date(0), lastInteractionAt: new Date(0) }; // Mock if missing

        const existing = await (prisma as any).conversation.findUnique({
            where: { pageId_psid: { pageId, psid } }
        });

        if (existing) return existing;

        return (prisma as any).conversation.create({
            data: {
                pageId,
                psid,
                lastInteractionAt: new Date() // Initialize with now
            }
        });
    } catch (e) {
        console.warn("Conversation tracking failed", e);
        return { lastUserMessageAt: new Date(0), lastInteractionAt: new Date(0) };
    }
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
    // ---------------------------------------------------------
    // FLOW JUMP OVERRIDE
    // ---------------------------------------------------------
    if (text.startsWith("FLOW_JUMP::")) {
        const target = text.split("::")[1];
        console.log(`[Engine] FLOW_JUMP detected to: ${target}`);

        // Try to find rule by ID or Name
        const rule = await prisma.automationRule.findFirst({
            where: {
                workspaceId: page.workspaceId,
                isActive: true,
                OR: [
                    { id: target },
                    { name: target }
                ]
            },
            include: { actions: { orderBy: { order: 'asc' } } }
        });

        if (rule) {
            await executeRule(rule, page, contact, incomingLogId, text);
            return;
        } else {
            console.warn(`[Engine] FLOW_JUMP failed: Rule '${target}' not found or inactive.`);
        }
    }

    // 1. Fetch Active Rules (Filter by type in memory)
    const validTypes = ['MESSAGE_ANY'];
    if (isOutside24H) validTypes.push('MESSAGE_OUTSIDE_24H');

    // ---------------------------------------------------------
    // 0. Check Conversation State (Flow System)
    // ---------------------------------------------------------
    if (!isOutside24H) {
        try {
            // Check if user is in a flow
            const state = await (prisma as any).conversationState.findUnique({
                where: { pageId_senderPsid: { pageId: page.pageId, senderPsid: contact.psid } }
            });

            if (state) {
                // Check Expiration
                if (state.expiresAt < new Date()) {
                    console.log(`[Flow] State expired for ${contact.psid}`);
                    await (prisma as any).conversationState.delete({ where: { id: state.id } });
                } else {
                    // Process Flow Step
                    console.log(`[Flow] Processing step ${state.stepId} for ${contact.psid}`);
                    await processConditionalStep(state, page, contact, text, incomingLogId);
                    return; // STOP normal rule processing
                }
            }
        } catch (e) {
            console.error("[Flow] State Check Error", e);
        }
    }

    const allRules = await prisma.automationRule.findMany({
        where: {
            workspaceId: page.workspaceId,
            isActive: true
        },
        orderBy: [
            { priority: 'desc' },
            { createdAt: 'asc' }
        ],
        include: {
            actions: { orderBy: { order: 'asc' } }
        }
    });

    // In-memory filter
    const rules = allRules.filter((r: any) => validTypes.includes(r.triggerType || 'MESSAGE_ANY'));

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
        // ---------------------------------------------------------
        // FALLBACK LOGIC (No standard rule matched)
        // ---------------------------------------------------------

        // 1. Check if Page has Default Rule
        // We need to fetch page with defaultRuleId if not already loaded? 
        // The 'page' arg usually comes from 'processMessengerEvent' -> 'prisma.messengerPage.findUnique'.
        // We need to ensure 'defaultRuleId' is fetched or re-fetch it here.
        // Optimization: Let's re-fetch only if not present in object (or just fetch simple id)

        let defaultRuleId = (page as any).defaultRuleId;

        // If typescript complains, we might need to cast or re-fetch. 
        // safe bit: re-fetch distinct field if uncertain, or trust calling scope updated include.
        // The calling scope (handleMessagingEvent) includes { workspace: true }. It might NOT include defaultRuleId if specific select wasn't used (gets all scalars by default).
        // defaultRuleId is a scalar, so it SHOULD be there.

        if (defaultRuleId) {
            console.log(`[Engine] No match found. Checking Fallback Rule: ${defaultRuleId}`);

            // 2. Cooldown Check (Prevent Loop)
            // Strategy: Check last log for this Contact that was a FALLBACK execution within X minutes.
            // We can identify fallback execution by a specific tag in MessageLog? 
            // Or RuleExecution? 
            // RuleExecution records the ruleId. We can check if we executed 'defaultRuleId' recently.

            const FALLBACK_COOLDOWN_MINUTES = 5;
            const cooldownCutoff = new Date(Date.now() - FALLBACK_COOLDOWN_MINUTES * 60 * 1000);

            const recentFallback = await prisma.ruleExecution.findFirst({
                where: {
                    ruleId: defaultRuleId,
                    contactId: contact.id,
                    lastExecutedAt: { gte: cooldownCutoff }
                }
            });

            if (recentFallback) {
                console.log(`[Engine] Fallback suppressed by cooldown (${FALLBACK_COOLDOWN_MINUTES}m)`);
                await prisma.messageLog.update({
                    where: { id: incomingLogId },
                    data: { status: 'SKIPPED', error: 'Fallback Cooldown' }
                });
            } else {
                // 3. Execute Fallback
                const fallbackRule = await prisma.automationRule.findUnique({
                    where: { id: defaultRuleId },
                    include: { actions: { orderBy: { order: 'asc' } } }
                });

                if (fallbackRule && fallbackRule.isActive) {
                    console.log(`[Engine] Executing Fallback Rule: ${fallbackRule.name}`);

                    // Update Log to reflect Fallback
                    await prisma.messageLog.update({
                        where: { id: incomingLogId },
                        data: {
                            matchedRuleId: fallbackRule.id,
                            status: 'MATCHED_FALLBACK' // Custom status for clarity? or just MATCHED 
                            // Schema allows string, so 'MATCHED_FALLBACK' works if no enum constraint. 
                            // Checking schema... status is String. Good.
                        }
                    });

                    // Execute
                    await executeRule(fallbackRule, page, contact, incomingLogId, text);
                    return; // Done
                } else {
                    console.log(`[Engine] Fallback rule not found or inactive.`);
                }
            }
        }

        // No match and No Fallback (or blocked)
        await prisma.messageLog.update({
            where: { id: incomingLogId },
            data: { status: 'SKIPPED' } // Default "No Match"
        });
    }
}

async function matchAndExecuteComment(page: any, commentEvent: any) {
    const text = commentEvent.message || "";
    if (!text) return;

    // Fetch ALL active rules for workspace and filter in-memory
    // This bypasses "Unknown argument triggerType" if Prisma Client is outdated
    const allRules = await prisma.automationRule.findMany({
        where: {
            workspaceId: page.workspaceId,
            isActive: true
        },
        orderBy: { priority: 'desc' },
        include: { actions: true }
    });

    const rules = allRules.filter((r: any) => r.triggerType === 'COMMENT_ON_POST');

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
        // Use standard Rule Keywords via checkMatch
        if (!checkMatch(rule, text)) continue;

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

        console.log(`[Engine] Rule matched: ${matchedRule.name}. Creating outgoing log for PSID: ${commenterPsid}`);

        // Create MessageLog (Legacy/Standard) for proper status tracking in sendAction
        const logEntry = await prisma.messageLog.create({
            data: {
                pageId: page.pageId,
                contactId: contact.id,
                direction: 'OUT',
                // source: 'comment_dm', // Not in schema, skipping
                actionType: 'text',     // messageType -> actionType
                matchedRuleId: matchedRule.id, // ruleId -> matchedRuleId
                status: 'PENDING'
            }
        });

        // Create MessageEvent (New Architecture) for Counters/Analytics
        try {
            if ((prisma as any).messageEvent) {
                await (prisma as any).messageEvent.create({
                    data: {
                        pageId: page.pageId,
                        psid: commenterPsid,
                        direction: 'OUT',
                        source: 'comment_dm',
                        messageType: 'text',
                        ruleId: matchedRule.id,
                        payloadJson: { text: text, action: 'reply_to_comment', comment_id: commentEvent.comment_id }
                    }
                });
            }
        } catch (e) { console.warn("Failed to create MessageEvent OUT", e); }

        // Execute actions
        console.log(`[Engine] Executing actions for rule ${matchedRule.id}, replyToCommentId: ${commentEvent.comment_id}`);
        await executeRule(matchedRule, page, contact, logEntry.id, text, commentEvent.comment_id);
    } else {
        console.log(`[Engine] No matching comment rule found for post ${commentEvent.post_id}`);
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

// ------------------------------------------------------------------
// ASYNC FLOW ENGINE (NO SLEEP)
// ------------------------------------------------------------------

export async function executeActionsUntilDelay(
    rule: any,
    page: any,
    contact: any,
    initialIndex: number,
    runId: string,
    refLogId: string,
    replyToCommentId?: string,
    isResuming = false // New flag to handle resumption
) {
    const actions = rule.actions || [];

    console.log(`[Engine] Executing run ${runId} starting at ${initialIndex}/${actions.length} (Resuming: ${isResuming})`);

    for (let i = initialIndex; i < actions.length; i++) {
        const action = actions[i];

        // Check for delay
        // If we are resuming at this index (i === initialIndex), we assume the delay is DONE.
        // If we are processing a subsequent action (i > initialIndex) OR not resuming, we respect the delay.
        if (action.delayMs > 0 && !(isResuming && i === initialIndex)) {
            // Found a delay -> Pause & Schedule
            console.log(`[Engine] Paused run ${runId} at action ${i} for ${action.delayMs}ms`);

            await saveAndScheduleExecution({
                executionId: runId,
                pageId: page.pageId,
                psid: contact.psid,
                ruleId: rule.id,
                nextIndex: i, // Resume AT THIS action (to execute it), NOT after it
                createdAt: Date.now(),
                runAt: Date.now() + action.delayMs,
                refLogId,
                replyToCommentId
            }, action.delayMs);

            return { status: 'PAUSED' };
        }

        // Execute Action
        try {
            // Only use comment reply on the very first action of the entire sequence (index 0)
            const useCommentReply = (i === 0 && !!replyToCommentId);
            await sendAction(page, contact, action, refLogId, useCommentReply ? replyToCommentId : undefined);
        } catch (e: any) {
            console.error(`[Engine] Action ${i} failed in run ${runId}`, e);
        }
    }

    console.log(`[Engine] Run ${runId} completed.`);
    await clearExecution(runId);
    return { status: 'DONE' };
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

    // ---------------------------------------------------------
    // FLOW INITIATION
    // ---------------------------------------------------------
    if ((rule as any).flow && ((rule as any).flow as any).enabled) {
        try {
            const flow = (rule as any).flow as any;
            if (flow.steps && flow.steps.length > 0) {
                const firstStep = flow.steps[0];
                console.log(`[Flow] Starting flow ${rule.name}, step ${firstStep.id}`);

                // Create Active State
                await (prisma as any).conversationState.upsert({
                    where: { pageId_senderPsid: { pageId: page.pageId, senderPsid: contact.psid } },
                    create: {
                        pageId: page.pageId,
                        senderPsid: contact.psid,
                        ruleId: rule.id,
                        stepId: firstStep.id,
                        status: 'waiting_input',
                        expectedType: firstStep.expectedType || 'any',
                        expiresAt: new Date(Date.now() + (firstStep.expirationSeconds || 300) * 1000)
                    },
                    update: {
                        ruleId: rule.id,
                        stepId: firstStep.id,
                        status: 'waiting_input',
                        expiresAt: new Date(Date.now() + (firstStep.expirationSeconds || 300) * 1000)
                    }
                });

                // Send First Message
                await sendAction(page, contact, { type: 'TEXT', payload: { text: firstStep.message } }, refLogId);
                return; // Flow started, stop normal actions
            }
        } catch (e) {
            console.error("[Flow] Failed to start flow", e);
        }
    }

    // Start Async Execution
    const executionId = uuidv4();
    try {
        await executeActionsUntilDelay(
            rule,
            page,
            contact,
            0,
            executionId,
            refLogId,
            replyToCommentId
        );
    } catch (e) {
        console.error(`[Engine] Failed to start run ${executionId}`, e);
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

    // SAFEGUARD: Comment Replies (Private Replies) usually only support TEXT.
    // If we try to send a template, it might fail.
    // specificially, "message" field restrictions apply.
    const isCommentReply = !!replyToCommentId;
    const actionTypeLabel = action.type;

    switch (action.type) {
        case 'TEXT':
            messageBody.message = { text: payload.text };
            break;

        case 'MESSAGE_WITH_BUTTONS':
        case 'BUTTON_TEMPLATE':
            // Logic: If has buttons -> Template. If not -> Text.
            const hasButtons = payload.buttons && Array.isArray(payload.buttons) && payload.buttons.length > 0;
            // Support both 'text' (old) and 'message' (new)
            const textContent = payload.text || payload.message || "";

            if (isCommentReply || !hasButtons) {
                // Send as Text (Buttons appended as text if comment reply)
                let finalStats = textContent;
                if (hasButtons && isCommentReply) {
                    const btnText = payload.buttons.map((b: any) => `[${b.title || b.label}]`).join(' ');
                    finalStats += `\n\n${btnText}`;
                }
                messageBody.message = { text: finalStats };
            } else {
                // Send as Button Template
                messageBody.message = {
                    attachment: {
                        type: "template",
                        payload: {
                            template_type: "button",
                            text: textContent,
                            buttons: payload.buttons.map((b: any) => {
                                const isNewUrl = b.actionType === 'url';
                                const isNewPostback = b.actionType === 'reply' || b.actionType === 'flow_jump';
                                const type = isNewUrl ? 'web_url' : (isNewPostback ? 'postback' : (b.type || 'web_url'));

                                let payloadVal = undefined;
                                if (b.actionType === 'flow_jump') payloadVal = `FLOW_JUMP::${b.value}`;
                                else if (b.actionType === 'reply') payloadVal = b.value;
                                else payloadVal = b.payload;

                                return {
                                    type: type,
                                    url: (type === 'web_url' ? (b.url || b.value) : undefined),
                                    title: b.label || b.title,
                                    payload: payloadVal
                                };
                            })
                        }
                    }
                };
            }
            break;

        case 'GENERIC_TEMPLATE': {
            // Use derived (cropped) image if available, otherwise original
            const cardImageUrl = (payload.cropMode === 'AUTO_CENTER_CROP' && payload.derivedImageUrl)
                ? payload.derivedImageUrl
                : payload.imageUrl;

            // Map cardFormat to Messenger's image_aspect_ratio
            // Messenger only supports "square" (1:1) and "horizontal" (1.91:1)
            // For formats like PORTRAIT that don't have a native match,
            // the image is FIT into a square canvas (via derive), so "square" is used
            const formatKey = (payload.cardFormat || 'SQUARE') as string;
            const messengerAspectRatio = formatKey === 'LANDSCAPE' ? 'horizontal' : 'square';

            if (isCommentReply) {
                // Convert to text
                const buttons = payload.buttons?.map((b: any) => `[${b.title}] ${b.type === 'web_url' ? b.url : ''}`).join('\n');
                messageBody.message = { text: `${payload.title}\n${payload.subtitle || ''}\n${cardImageUrl || ''}\n\n${buttons}` };
            } else {
                messageBody.message = {
                    attachment: {
                        type: "template",
                        payload: {
                            template_type: "generic",
                            image_aspect_ratio: messengerAspectRatio,
                            elements: [
                                {
                                    title: payload.title,
                                    subtitle: payload.subtitle,
                                    image_url: cardImageUrl,
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
            }
            break;
        }


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

        // 2. Log to MessageEvent (New Architecture)
        // We log the *result* event here.
        if (success) {
            try {
                if ((prisma as any).messageEvent) {
                    await (prisma as any).messageEvent.create({
                        data: {
                            pageId: page.pageId,
                            psid: contact.psid,
                            direction: 'OUT',
                            source: 'automation',
                            messageType: 'text', // simplified
                            payloadJson: body,
                            createdAt: new Date()
                        }
                    });
                }
            } catch (e) {
                // ignore
            }
        }

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

// ------------------------------------------------------------------
// FLOW RECURSION ENGINE
// ------------------------------------------------------------------
async function processConditionalStep(state: any, page: any, contact: any, text: string, refLogId: string) {
    // Fetch Rule to get Definitions
    const rule = await prisma.automationRule.findUnique({ where: { id: state.ruleId } });
    if (!rule || !(rule as any).flow) {
        await (prisma as any).conversationState.delete({ where: { id: state.id } });
        return;
    }

    const flow = (rule as any).flow as any;
    const currentStep = flow.steps.find((s: any) => s.id === state.stepId);

    if (!currentStep) {
        await (prisma as any).conversationState.delete({ where: { id: state.id } });
        return;
    }

    const input = text.trim();
    let matchedCondition = null;

    // 1. Validation (Number Check)
    if (state.expectedType === 'number') {
        const num = parseFloat(input.replace(',', '.'));
        if (isNaN(num)) {
            // Not a number -> Fallback immediately
            console.log(`[Flow] Expected number, got '${input}'. Sending fallback.`);
            if (currentStep.fallback) {
                await sendAction(page, contact, { type: 'TEXT', payload: { text: currentStep.fallback.message || "Por favor, digite um número válido." } }, refLogId);
            }
            return; // State remains active
        }
    }

    // 2. Check Conditions
    if (currentStep.conditions) {
        for (const cond of currentStep.conditions) {
            // Exact Match (Case Insensitive)
            if (state.expectedType === 'number') {
                // Numeric Match
                const inputNum = parseFloat(input.replace(',', '.'));
                const condNum = parseFloat(cond.match.replace(',', '.'));
                if (!isNaN(inputNum) && !isNaN(condNum) && inputNum === condNum) {
                    matchedCondition = cond;
                    break;
                }
            } else {
                // String Match
                // If condition match is empty, does it mean "Any"? For now, assume explicit match needed.
                // Maybe add support for "*" as wildcard
                if (input.toLowerCase() === cond.match.toLowerCase() || cond.match === '*') {
                    matchedCondition = cond;
                    break;
                }
            }
        }
    }

    // 3. Handle Match or Fallback
    if (matchedCondition) {
        console.log(`[Flow] Matched condition '${matchedCondition.match}' -> Next: ${matchedCondition.nextStep}`);

        // Execute Actions (if any)
        if (matchedCondition.actions) {
            for (const action of matchedCondition.actions) {
                await sendAction(page, contact, action, refLogId);
            }
        }

        // Move to Next Step
        if (matchedCondition.nextStep) {
            const nextStep = flow.steps.find((s: any) => s.id === matchedCondition.nextStep);
            if (nextStep) {
                await (prisma as any).conversationState.update({
                    where: { id: state.id },
                    data: {
                        stepId: nextStep.id,
                        expectedType: nextStep.expectedType || 'any',
                        expiresAt: new Date(Date.now() + (nextStep.expirationSeconds || 300) * 1000)
                    }
                });
                // Send Next Question
                await sendAction(page, contact, { type: 'TEXT', payload: { text: nextStep.message } }, refLogId);
            } else {
                // Finish (Next step not found)
                await (prisma as any).conversationState.delete({ where: { id: state.id } });
            }
        } else {
            // No next step -> Finish
            await (prisma as any).conversationState.delete({ where: { id: state.id } });
        }
    } else {
        // Fallback
        console.log(`[Flow] No match for '${input}'. Sending fallback.`);
        if (currentStep.fallback) {
            await sendAction(page, contact, { type: 'TEXT', payload: { text: currentStep.fallback.message || "Opção inválida." } }, refLogId);
        }
        // State REMAINS active (waiting retry)
    }
}


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

