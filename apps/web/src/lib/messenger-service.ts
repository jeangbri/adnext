import { prisma } from "./prisma";
import { decrypt } from "./encryption";

const FB_API_URL = "https://graph.facebook.com/v19.0";

// NEW: Queue Job Handler or Inline Processor
export async function handleWebhookJob(eventId: string, payloadOverride?: any) {
    let body;
    if (payloadOverride) {
        body = payloadOverride;
    } else {
        const event = await prisma.webhookEvent.findUnique({ where: { id: eventId } });
        if (!event) return;
        body = event.payloadJson as any;
    }

    try {
        const object = body.object;
        if (object !== "instagram" && object !== "page") {
            return;
        }

        for (const entry of body.entry) {
            const messaging = entry.messaging || entry.changes;
            if (!messaging) continue;

            // Handle Messenger Array (usually 'messaging', sometimes 'standby')
            // Messenger 'messaging' is an array of objects.

            // Note: Instagram used 'changes' for comments, 'messaging' for DMs.
            // Messenger uses 'messaging'.

            for (const change of messaging) {
                if (change.message) {
                    await handleDmEvent(entry.id, change, eventId);
                }
                if (change.field === 'feed' || change.value?.item === 'comment' || change.item === 'comment') {
                    // Feed comments for Pages often come in 'changes' array with field='feed'
                    // We need to support both structures if we want full coverage.
                    // For now, let's assume 'messaging' loop covers DMs.
                    // Comments might be in entry.changes separately.
                }
            }

            // Separate loop for 'changes' if 'messaging' didn't cover it
            if (entry.changes) {
                for (const change of entry.changes) {
                    if (change.field === 'feed' && change.value?.item === 'comment') {
                        // Adapt to handleCommentEvent signature
                        // The structure is slightly different for Pages changes.
                        await handleCommentEvent(entry.id, change, eventId);
                    }
                }
            }
        }

        await prisma.webhookEvent.update({
            where: { id: eventId },
            data: { processingStatus: "DONE", processedAt: new Date() }
        });
    } catch (e: any) {
        console.error("Error processing webhook event", e);
        await prisma.webhookEvent.update({
            where: { id: eventId },
            data: { processingStatus: "ERROR", lastError: e.message }
        });
    }
}

export async function processInstagramEvent(body: any, signature: string | null) {
    // Legacy helper - redirects to job logic
    // Usually called directly in some older versions.
}

async function upsertContact(account: any, senderId: string) {
    if (!senderId) return;
    try {
        const token = decrypt(account.accessTokenEncrypted).trim();
        // Messenger User Profile API
        // https://developers.facebook.com/docs/messenger-platform/identity/user-profile/
        const fields = "first_name,last_name,profile_pic";
        const url = `${FB_API_URL}/${senderId}?fields=${fields}&access_token=${token}`;

        const res = await fetch(url);
        const userData = await res.json();

        if (userData.error) {
            console.error(`[Messenger Service] Contact Fetch Error for ${senderId}:`, userData.error);
            // Fallback create
            const existing = await prisma.contact.findUnique({
                where: { workspaceId_instagramId: { workspaceId: account.workspaceId, instagramId: senderId } }
            });
            if (!existing) {
                await prisma.contact.create({
                    data: {
                        workspaceId: account.workspaceId,
                        instagramId: senderId, // Storing PSID in instagramId col
                        fullName: "Messenger User",
                        lastInteraction: new Date()
                    }
                });
            } else {
                await prisma.contact.update({
                    where: { id: existing.id },
                    data: { lastInteraction: new Date() }
                });
            }
            return;
        }

        const name = `${userData.first_name} ${userData.last_name}`.trim() || "Messenger User";

        await prisma.contact.upsert({
            where: { workspaceId_instagramId: { workspaceId: account.workspaceId, instagramId: senderId } },
            create: {
                workspaceId: account.workspaceId,
                instagramId: senderId,
                username: null, // Messenger doesn't give usernames usually
                fullName: name,
                profilePicUrl: userData.profile_pic || null,
                isVerified: false,
                followerCount: 0,
                isFollowing: false,
                lastInteraction: new Date()
            },
            update: {
                fullName: name,
                profilePicUrl: userData.profile_pic || undefined,
                lastInteraction: new Date()
            }
        });
        console.log(`[Messenger Service] Contact upserted: ${senderId}, Name: ${name}`);
    } catch (e) {
        console.error(`[Messenger Service] Failed to execute upsert contact ${senderId}`, e);
    }
}

async function handleCommentEvent(accountId: string, event: any, eventId?: string) {
    const value = event.value;
    const fromId = value.from.id; // User who successfully commented
    const mediaId = value.media.id; // The Post ID
    const commentId = value.id;
    const text = value.text || "";

    // If it's the page itself commenting, ignore usually?
    // But we might want to reply to our own comments in some weird cases? No, usually ignore self.
    // We don't have easy way to know self ID here unless we query DB.
    // But handleDmEvent checks echoes. Comment webhook doesn't have is_echo.
    // We'll rely on workflow match.

    console.log(`[IG Service] Handling Comment. mediaId=${mediaId}, text="${text}"`);

    // 1. Find Connected Account (Page)
    // entry.id is the Instagram Account ID of the page receiving the comment
    let account = await prisma.connectedAccount.findFirst({
        where: { providerAccountId: accountId },
        include: { workspace: true }
    });

    if (!account) {
        console.warn(`[Messenger Service] Account not found for comment entryId: ${accountId}`);
        return;
    }

    // 2. Create/Update Contact
    await upsertContact(account, fromId);

    // 3. Find Workflows
    const workflows = await prisma.workflow.findMany({
        where: {
            workspaceId: account.workspaceId,
            isActive: true,
            status: "PUBLISHED",
            triggers: {
                some: {
                    type: "FEED_COMMENT"
                }
            }
        },
        include: {
            triggers: true,
            actions: true
        }
    });

    // 4. Match
    for (const workflow of workflows) {
        const trigger = workflow.triggers.find(t => t.type === "FEED_COMMENT");
        if (!trigger) continue;

        const config = trigger.configJson as any;
        const keywords = config.keywords;
        const matchMode = config.matchMode || "contains";
        const targetPosts = config.posts || []; // array of strings (media IDs)

        // Post Match
        // If targetPosts is not empty, we MUST match one of them.
        // If empty, we match ALL posts.
        if (targetPosts.length > 0) {
            if (!targetPosts.includes(mediaId)) {
                continue; // Not the right post
            }
        }

        // Keyword Match
        let matched = false;
        if (!keywords || keywords.length === 0) {
            matched = true;
        } else {
            const lowerText = text.toLowerCase();
            if (matchMode === "exact") {
                matched = keywords.some((k: string) => k.toLowerCase().trim() === lowerText);
            } else {
                matched = keywords.some((k: string) => lowerText.includes(k.toLowerCase().trim()));
            }
        }

        if (matched) {
            // Execute Actions
            // For comments, we usually use DM reply or Comment reply.
            // Our current runWorkflowActions supports SEND_DM.
            // If the user configures "Responder no Direct", it uses SEND_DM.
            // We pass fromId as recipientId.
            // IMPORTANT: To send DM to a commenter, we need "Private Replies" capability or just Send DM.
            // Standard Send DM might fail if user didn't message us first (24h window).
            // BUT "Private Replies" to comments is a specific API: POST /me/messages with recipient: { comment_id: ... }
            // Let's see if runWorkflowActions needs adjustment.

            await runWorkflowActions(workflow, account, fromId, eventId || 'temporary-id', commentId);
        }
    }

}


async function handleDmEvent(accountId: string, event: any, eventId?: string) {
    const senderId = event.sender.id;
    const recipientId = event.recipient.id;
    const message = event.message;

    if (message.is_echo) return; // Ignore echoes

    const text = message.text || "";

    const isStoryReply = !!(event.message.reply_to && event.message.reply_to.story);
    const targetTriggerType = isStoryReply ? "STORY_REPLY" : "DM_RECEIVED";

    console.log(`[Messenger Service] Handling DM. isStoryReply=${isStoryReply}, targetTriggerType=${targetTriggerType}, text="${text}"`);

    // 1. Find the connected account (Recipient)
    // providerAccountId should match recipientId
    let account = await prisma.connectedAccount.findFirst({
        where: { providerAccountId: recipientId },
        include: { workspace: true }
    });

    if (!account) {
        console.warn(`[Messenger Service] Account not found directly for recipientId: ${recipientId}. Attempting resolution via tokens...`);

        // Self-Healing: Try to find which account this ID belongs to by checking tokens
        const allAccounts = await prisma.connectedAccount.findMany({
            where: { status: 'CONNECTED' }
        });

        let foundAccount = null;

        for (const acc of allAccounts) {
            try {
                const token = decrypt(acc.accessTokenEncrypted);
                // Try to fetch the recipientId node using this token
                // We try both endpoints just in case, but usually graph.facebook.com for Page tokens
                const checkUrl = `${FB_API_URL}/${recipientId}?fields=id,name&access_token=${token}`;

                const res = await fetch(checkUrl);
                if (res.ok) {
                    const data = await res.json();

                    // If we can fetch it with our token, it might be us.
                    // Check if the ID matches what the API says is our ID?
                    // Or if name matches?
                    // Simpler: If we can fetch it, and the ID matches the ID of the token owner...
                    // Let's check /me with token to be sure?
                    // For now, let's assume if we can fetch it and name matches? 
                    // Or just if we can fetch it, and the ID returned IS the recipientId, then we own it?
                    // The issue is if we can fetch a user? No, /id returns node.
                    // If data.id == acc.providerAccountId?
                    // The legacy code checked `username`.
                    if (data.id === acc.providerAccountId || data.name === acc.name) {
                        console.log(`[Messenger Service] ID Mismatch Resolved! stored=${acc.providerAccountId}, incoming=${recipientId}. Updating DB...`);

                        // Update DB with the correct "Webhook-compatible" ID
                        foundAccount = await prisma.connectedAccount.update({
                            where: { id: acc.id },
                            data: { providerAccountId: recipientId }
                        });

                        // Re-fetch with workspace
                        foundAccount = await prisma.connectedAccount.findUnique({
                            where: { id: acc.id },
                            include: { workspace: true }
                        });
                        break;
                    }
                }
            } catch (ignore) { }
        }

        if (!foundAccount) {
            console.error(`[Messenger Service] Failed to resolve account for recipientId: ${recipientId}`);
            // DEBUG:
            console.log("ALL AVAILABLE ACCOUNTS (Failed resolution):", JSON.stringify(allAccounts.map(a => ({ id: a.id, providerAccountId: a.providerAccountId, name: a.name }))));
            return;
        }

        // Use the resolved account
        // @ts-ignore
        account = foundAccount;
    }

    if (!account) {
        console.error(`[IG Service] STOP: No account found for DM. Recipient: ${recipientId}`);
        return;
    }

    console.log(`[IG Service] Account identified: ${account.username}`);

    // 2. Upsert Contact
    await upsertContact(account, senderId);

    // 3. Find Workflows
    const workflows = await prisma.workflow.findMany({
        where: {
            workspaceId: account.workspaceId,
            isActive: true,
            status: "PUBLISHED",
            triggers: {
                some: {
                    type: targetTriggerType
                }
            }
        },
        include: {
            triggers: true,
            actions: true
        }
    });

    console.log(`[IG Service] Found ${workflows.length} active workflows for ${targetTriggerType}`);

    // 4. Match Triggers
    for (const workflow of workflows) {
        const trigger = workflow.triggers.find(t => t.type === targetTriggerType);
        if (!trigger) {
            console.log(`[IG Service] Trigger of type ${targetTriggerType} not found in workflow ${workflow.title}`);
            continue;
        }

        const config = trigger.configJson as any;
        const keywords = config.keywords; // string[]
        const matchMode = config.matchMode || "contains";

        console.log(`[IG Service] Checking workflow "${workflow.title}". Keywords: ${JSON.stringify(keywords)}, Mode: ${matchMode}`);

        let matched = false;

        // If no keywords, match everything
        if (!keywords || keywords.length === 0) {
            matched = true;
        } else {
            const lowerText = text.toLowerCase();
            if (matchMode === "exact") {
                matched = keywords.some((k: string) => k.toLowerCase().trim() === lowerText);
            } else {
                matched = keywords.some((k: string) => lowerText.includes(k.toLowerCase().trim()));
            }
        }

        if (matched) {
            // Execute Actions
            await runWorkflowActions(workflow, account, senderId, eventId || 'temporary-id');
        }
    }

}


async function runWorkflowActions(workflow: any, account: any, recipientId: string, webhookEventId: string, commentId?: string) {
    const run = await prisma.automationRun.create({
        data: {
            workflowId: workflow.id,
            webhookEventId: webhookEventId,
            status: "RUNNING"
        }
    });

    try {
        console.log(`[IG Service] Starting Graph Execution for workflow: ${workflow.title}`);

        // Start from the trigger node that would have matched
        const flow = workflow.flowDefinition as any;
        if (!flow || !flow.nodes) throw new Error("Flow definition missing");

        // Simple: Find the trigger node to start from
        // Note: For now we just find any trigger node, but ideally we'd pass the specific ID
        const triggerNode = flow.nodes.find((n: any) =>
            n.type === 'trigger' || n.type === 'trigger_comment' || n.type === 'trigger_mention'
        );

        if (triggerNode) {
            await executeWorkflowNode(workflow, account, recipientId, triggerNode.id, run.id, commentId || null);
        }

    } catch (e: any) {
        console.error("Error executing workflow", e);
        await prisma.automationRun.update({
            where: { id: run.id },
            data: {
                status: "ERROR",
                finishedAt: new Date(),
                errorMessage: e.message
            }
        });
    }
}

async function executeWorkflowNode(workflow: any, account: any, recipientId: string, nodeId: string, runId: string, commentId: string | null) {
    const flow = workflow.flowDefinition as any;
    const edges = (flow.edges || []).filter((e: any) => e.source === nodeId);

    for (const edge of edges) {
        const nextNode = (flow.nodes || []).find((n: any) => n.id === edge.target);
        if (!nextNode) continue;

        console.log(`[Messenger Service] Executing ${nextNode.type} (${nextNode.id})`);

        if (nextNode.type === 'instagram' || nextNode.type === 'messenger') {
            const { content } = nextNode.data || {};
            const text = content?.message || '';
            const imageUrl = content?.imageUrl || '';
            const buttons = content?.buttons || [];

            if (commentId) {
                await sendPrivateReply(account, commentId, text, buttons, imageUrl);
            } else {
                await sendDm(account, recipientId, text, buttons, imageUrl);
            }
            await executeWorkflowNode(workflow, account, recipientId, nextNode.id, runId, commentId);
        }
        else if (nextNode.type === 'delay') {
            const { scheduleWorkflowResume } = require('./qstash');
            const { parseTimeToMs } = require('./utils');

            const timeStr = nextNode.data?.time || '1 minuto';
            const ms = parseTimeToMs(timeStr);
            const seconds = Math.ceil(ms / 1000);

            console.log(`[IG Service] ⏳ Scheduling QStash Delay. String="${timeStr}", Seconds=${seconds}. Job: resumeWorkflow`);

            await scheduleWorkflowResume(seconds, {
                workflowId: workflow.id,
                accountId: account.id,
                senderId: recipientId,
                nodeId: nextNode.id,
                runId,
                commentId
            });

            console.log(`[IG Service] ✅ Job Scheduled on QStash successfully.`);
            return;
        }
        else if (nextNode.type === 'tag') {
            const newTags = nextNode.data?.tags || [];
            const contact = await prisma.contact.findUnique({
                where: { workspaceId_instagramId: { workspaceId: account.workspaceId, instagramId: recipientId } }
            });

            const currentTags = contact?.tags || [];
            const updatedTags = Array.from(new Set([...currentTags, ...newTags]));

            await prisma.contact.upsert({
                where: { workspaceId_instagramId: { workspaceId: account.workspaceId, instagramId: recipientId } },
                create: {
                    workspaceId: account.workspaceId,
                    instagramId: recipientId,
                    tags: newTags,
                    lastInteraction: new Date()
                },
                update: { tags: { set: updatedTags } }
            });
            await executeWorkflowNode(workflow, account, recipientId, nextNode.id, runId, commentId);
        }
        else if (nextNode.type === 'condition') {
            const contact = await prisma.contact.findUnique({
                where: { workspaceId_instagramId: { workspaceId: account.workspaceId, instagramId: recipientId } }
            });

            const userTags = contact?.tags || [];
            const tagToCheck = nextNode.data?.tag || '';
            const matches = userTags.includes(tagToCheck);

            const handle = matches ? 'true' : 'false';
            const branchEdge = (flow.edges || []).find((e: any) => e.source === nextNode.id && e.sourceHandle === handle);
            if (branchEdge) {
                await executeWorkflowNode(workflow, account, recipientId, branchEdge.target, runId, commentId);
            }
            return;
        }
        else {
            await executeWorkflowNode(workflow, account, recipientId, nextNode.id, runId, commentId);
        }
    }

    if (edges.length === 0) {
        await prisma.automationRun.update({
            where: { id: runId },
            data: { status: "SUCCESS", finishedAt: new Date() }
        });
    }
}

async function sendDm(account: any, recipientId: string, text: string, buttons?: any[], imageUrl?: string) {
    let accessToken = decrypt(account.accessTokenEncrypted).trim();

    console.log(`[Messenger Service] Sending DM to ${recipientId}. Image: ${!!imageUrl}, Buttons: ${buttons?.length || 0}`);

    const url = `${FB_API_URL}/me/messages?access_token=${accessToken}`;

    let body;

    if (imageUrl) {
        // Generic Template for Image + Text + Buttons
        body = {
            recipient: { id: recipientId },
            message: {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "generic",
                        elements: [
                            {
                                title: text || " ", // Title is required for generic template
                                image_url: imageUrl,
                                buttons: buttons && buttons.length > 0 ? buttons.slice(0, 3).map(b => ({
                                    type: "web_url",
                                    url: b.url,
                                    title: b.label
                                })) : undefined
                            }
                        ]
                    }
                }
            }
        };
    } else if (buttons && buttons.length > 0) {
        body = {
            recipient: { id: recipientId },
            message: {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "button",
                        text: text, // Button template text (max 640 chars)
                        buttons: buttons.map(b => ({
                            type: "web_url", // Currently strictly web_url based on UI
                            url: b.url,
                            title: b.label
                        }))
                    }
                }
            }
        };
    } else {
        body = {
            recipient: { id: recipientId },
            message: { text: text }
        };
    }

    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();

    if (!res.ok) {
        console.error("[Messenger Service] DM Send Failed:", JSON.stringify(data));
        throw new Error(`Failed to send DM: ${JSON.stringify(data)}`);
    }
    return data;
}

async function sendPrivateReply(account: any, commentId: string, text: string, buttons?: any[], imageUrl?: string) {
    let accessToken = decrypt(account.accessTokenEncrypted).trim();

    console.log(`[Messenger Service] Sending Private Reply to Comment ${commentId}. Image: ${!!imageUrl}, Buttons: ${buttons?.length || 0}`);

    const url = `${FB_API_URL}/me/messages?access_token=${accessToken}`;

    let body;

    if (imageUrl) {
        body = {
            recipient: { comment_id: commentId },
            message: {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "generic",
                        elements: [
                            {
                                title: text || " ",
                                image_url: imageUrl,
                                buttons: buttons && buttons.length > 0 ? buttons.slice(0, 3).map(b => ({
                                    type: "web_url",
                                    url: b.url,
                                    title: b.label
                                })) : undefined
                            }
                        ]
                    }
                }
            }
        };
    } else if (buttons && buttons.length > 0) {
        // Attempting Button Template for Private Reply
        body = {
            recipient: { comment_id: commentId },
            message: {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "button",
                        text: text,
                        buttons: buttons.map(b => ({
                            type: "web_url",
                            url: b.url,
                            title: b.label
                        }))
                    }
                }
            }
        };
    } else {
        body = {
            recipient: { comment_id: commentId },
            message: { text: text }
        };
    }

    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();

    if (!res.ok) {
        console.error("[Messenger Service] Private Reply Failed:", JSON.stringify(data));
        // If the error implies attachment not supported, we could retry with text only?
        // But for now, throw.
        throw new Error(`Failed to send Private Reply: ${JSON.stringify(data)}`);
    }
    return data;
}

async function replyToComment(account: any, commentId: string, text: string) {
    let accessToken = decrypt(account.accessTokenEncrypted).trim();

    console.log(`[Messenger Service] public Reply to Comment ${commentId}.`);

    const url = `${FB_API_URL}/${commentId}/replies?access_token=${accessToken}`;

    const body = { message: text };

    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();

    if (!res.ok) {
        console.error("[IG Service] Public Comment Reply Failed:", JSON.stringify(data));
        throw new Error(`Failed to reply to comment: ${JSON.stringify(data)}`);
    }
    return data;
}

export async function resumeWorkflowFromJob(data: any) {
    console.log(`[Worker] Resuming workflow run ${data.runId} at node ${data.nodeId}`);

    // 1. Fetch Workflow & Account
    const workflow = await prisma.workflow.findUnique({
        where: { id: data.workflowId },
        include: { triggers: true, actions: true }
    });

    const account = await prisma.connectedAccount.findUnique({
        where: { id: data.accountId },
        include: { workspace: true }
    });

    if (!workflow || !account) {
        console.error("[Worker] Workflow or Account not found", data);
        await prisma.automationRun.update({
            where: { id: data.runId },
            data: { status: "ERROR", errorMessage: "Resuming failed: Context lost" }
        });
        return;
    }

    // 2. Call executeWorkflowNode
    await executeWorkflowNode(workflow, account, data.senderId, data.nodeId, data.runId, data.commentId);
}

