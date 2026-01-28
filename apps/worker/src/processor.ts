import { PrismaClient, WebhookEvent, Workflow, InstagramAccount } from '@repo/db';
import { sendDM, replyComment, sendPrivateReply } from './instagram-api';
import { parseTimeToMs } from './utils';
import { instagramQueue } from './redis';

const prisma = new PrismaClient();

export async function processWebhookEvent(eventId: string) {
    const event = await prisma.webhookEvent.findUnique({
        where: { id: eventId }
    });

    if (!event) return;

    await prisma.webhookEvent.update({
        where: { id: eventId },
        data: { processingStatus: 'PROCESSING' }
    });

    try {
        const payload = event.payloadJson as any;

        for (const entry of payload.entry || []) {
            const igUserId = entry.id;

            const account = await prisma.instagramAccount.findFirst({
                where: { igUserId: String(igUserId) }
            });

            if (!account) {
                console.log(`No account found for IG User ID: ${igUserId}`);
                continue;
            }

            if (entry.messaging) {
                for (const msg of entry.messaging) {
                    await handleMessagingEvent(msg, account, event);
                }
            }

            if (entry.changes) {
                for (const change of entry.changes) {
                    await handleChangeEvent(change, account, event);
                }
            }
        }

        await prisma.webhookEvent.update({
            where: { id: eventId },
            data: { processingStatus: 'DONE', processedAt: new Date() }
        });

    } catch (err: any) {
        console.error(`Error processing event ${eventId}:`, err);
        await prisma.webhookEvent.update({
            where: { id: eventId },
            data: {
                processingStatus: 'ERROR',
                lastError: err.message
            }
        });
    }
}

async function handleMessagingEvent(msg: any, account: InstagramAccount, event: WebhookEvent) {
    const senderId = msg.sender.id;
    if (msg.message?.is_echo) return;

    const messageText = msg.message?.text || '';
    const isStoryReply = !!msg.message?.reply_to?.story;
    const channel = isStoryReply ? 'STORY_REPLY' : 'DM_RECEIVED';

    const workflows = await findMatchingWorkflows(account, channel, messageText);

    for (const wf of workflows) {
        const triggerNode = findTriggerNode(wf, channel, messageText);
        if (triggerNode) {
            await startWorkflowExecution(wf, account, senderId, triggerNode.id, event.id, null);
        }
    }
}

async function handleChangeEvent(change: any, account: InstagramAccount, event: WebhookEvent) {
    if (change.field === 'comments') {
        const value = change.value;
        const fromId = value.from?.id;
        if (fromId === account.igUserId) return;

        const text = value.text;
        const commentId = value.id;

        if (value.verb !== 'add') return;

        const workflows = await findMatchingWorkflows(account, 'FEED_COMMENT', text);
        for (const wf of workflows) {
            const triggerNode = findTriggerNode(wf, 'FEED_COMMENT', text);
            if (triggerNode) {
                await startWorkflowExecution(wf, account, fromId, triggerNode.id, event.id, commentId);
            }
        }
    }
}

async function findMatchingWorkflows(account: InstagramAccount, channel: string, text: string) {
    return prisma.workflow.findMany({
        where: {
            workspaceId: account.workspaceId,
            status: 'PUBLISHED',
            isActive: true,
            triggers: { some: { type: channel } }
        },
        include: { triggers: true }
    });
}

function findTriggerNode(workflow: Workflow, type: string, text: string) {
    const flow = workflow.flowDefinition as any;
    if (!flow || !flow.nodes) return null;

    // Map internal channel to node type
    const nodeType = type === 'FEED_COMMENT' ? 'trigger_comment' : (type === 'STORY_REPLY' ? 'trigger_mention' : 'trigger');

    return flow.nodes.find((n: any) => {
        if (n.type !== nodeType && n.type !== 'trigger') return false; // trigger is generic
        const config = n.data?.config || {};
        const keyword = config.keyword || '';
        const matchType = config.matchType || 'exact';

        if (!keyword) return true;
        if (matchType === 'exact') return text.toLowerCase() === keyword.toLowerCase();
        return text.toLowerCase().includes(keyword.toLowerCase());
    });
}

async function startWorkflowExecution(workflow: Workflow, account: InstagramAccount, senderId: string, nodeId: string, eventId: string, commentId: string | null) {
    const run = await prisma.automationRun.create({
        data: {
            workflowId: workflow.id,
            webhookEventId: eventId,
            status: 'RUNNING',
            startedAt: new Date(),
            correlationId: senderId
        }
    });

    try {
        await executeWorkflowNode(workflow, account, senderId, nodeId, run.id, commentId);

        // Update stats
        await prisma.workflow.update({
            where: { id: workflow.id },
            data: { runCount: { increment: 1 }, lastRunAt: new Date() }
        });
    } catch (e: any) {
        console.error('Workflow Execution Failed', e);
        await prisma.automationRun.update({
            where: { id: run.id },
            data: { status: 'ERROR', errorMessage: e.message, finishedAt: new Date() }
        });
    }
}

export async function resumeWorkflow(data: any) {
    const { workflowId, accountId, senderId, nodeId, runId, commentId } = data;

    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
    const account = await prisma.instagramAccount.findUnique({ where: { id: accountId } });

    if (!workflow || !account) return;

    try {
        await executeWorkflowNode(workflow, account, senderId, nodeId, runId, commentId);
    } catch (e) {
        console.error('Workflow Resumption Failed', e);
    }
}

async function executeWorkflowNode(workflow: any, account: any, senderId: string, nodeId: string, runId: string, commentId: string | null) {
    const flow = workflow.flowDefinition as any;
    if (!flow) return;

    // 1. Get Outgoing Edges
    const edges = (flow.edges || []).filter((e: any) => e.source === nodeId);

    for (const edge of edges) {
        const nextNode = (flow.nodes || []).find((n: any) => n.id === edge.target);
        if (!nextNode) continue;

        console.log(`[Flow] Executing node ${nextNode.id} (${nextNode.type}) for ${senderId}`);

        // Handle Node Types
        if (nextNode.type === 'instagram') {
            const { content } = nextNode.data || {};
            const text = content?.message || '';
            const imageUrl = content?.imageUrl || '';
            const buttons = content?.buttons || [];

            if (commentId && nextNode.data?.enableCommentReply) {
                // Public reply if configured
                await replyComment(account.accessTokenEncrypted, commentId, nextNode.data.commentReplyMessage);
            }

            if (commentId) {
                await sendPrivateReply(account.accessTokenEncrypted, commentId, text, imageUrl, buttons);
            } else {
                await sendDM(account.accessTokenEncrypted, senderId, text, imageUrl, buttons);
            }

            // Continue
            await executeWorkflowNode(workflow, account, senderId, nextNode.id, runId, commentId);
        }
        else if (nextNode.type === 'delay') {
            const timeStr = nextNode.data?.time || '1 minuto';
            const ms = parseTimeToMs(timeStr);

            await instagramQueue.add('resumeWorkflow', {
                workflowId: workflow.id,
                accountId: account.id,
                senderId,
                nodeId: nextNode.id,
                runId,
                commentId
            }, { delay: ms });

            return; // STOP execution here, worker will resume
        }
        else if (nextNode.type === 'tag') {
            const newTags = (nextNode.data?.tags || []) as string[];
            // Update Follower Tags
            await prisma.instagramFollower.upsert({
                where: { igUserId_accountId: { igUserId: senderId, accountId: account.id } },
                create: { igUserId: senderId, accountId: account.id, tags: newTags },
                update: { tags: { set: newTags } } // Simple set for now
            });

            await executeWorkflowNode(workflow, account, senderId, nextNode.id, runId, commentId);
        }
        else if (nextNode.type === 'condition') {
            const follower = await prisma.instagramFollower.findUnique({
                where: { igUserId_accountId: { igUserId: senderId, accountId: account.id } }
            });

            const currentTags = follower?.tags || [];
            const conditionTag = nextNode.data?.tag || '';
            // Note: Editor might use different data structure for conditions, 
            // we assume a simple 'if has tag' logic for now.

            const matches = !conditionTag || currentTags.includes(conditionTag);
            const targetHandle = matches ? 'true' : 'false';

            // Find specific edge for this handle
            const branchEdge = (flow.edges || []).find((e: any) => e.source === nextNode.id && e.sourceHandle === targetHandle);
            if (branchEdge) {
                const branchedNode = (flow.nodes || []).find((n: any) => n.id === branchEdge.target);
                if (branchedNode) {
                    await executeWorkflowNode(workflow, account, senderId, branchedNode.id, runId, commentId);
                }
            }
            return; // Condition branches, don't follow generic edges
        }
        else {
            // Generic Fallthrough (AI Node, Webhook, etc can be added here)
            await executeWorkflowNode(workflow, account, senderId, nextNode.id, runId, commentId);
        }
    }

    // If no more edges, update to success
    if (edges.length === 0) {
        await prisma.automationRun.update({
            where: { id: runId },
            data: { status: 'SUCCESS', finishedAt: new Date() }
        });
    }
}
