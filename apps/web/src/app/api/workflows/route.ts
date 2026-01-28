import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryWorkspace } from "@/lib/workspace";

export async function POST(req: NextRequest) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { title, description, channels, feedConfig } = body; // channels: ['dm', ...], feedConfig?: { targetMediaId: string }

    const workspace = await getPrimaryWorkspace(user.id, user.email || '');

    const workflow = await prisma.workflow.create({
        data: {
            workspaceId: workspace.id,
            title,
            description,
            channels, // string[] stored as Json
            isActive: true, // Auto-active but draft
            status: 'DRAFT'
        }
    });

    // Create Triggers and Actions default
    // Map channels to triggers types
    // 'dm' -> DM_RECEIVED
    // 'story' -> STORY_REPLY
    // 'feed' -> FEED_COMMENT

    const triggerMap: Record<string, string> = {
        'dm': 'DM_RECEIVED',
        'story': 'STORY_REPLY',
        'feed': 'FEED_COMMENT'
    };

    const actionMap: Record<string, string> = {
        'dm': 'SEND_DM',
        'story': 'SEND_DM',
        'feed': 'REPLY_COMMENT'
    };

    // Create Triggers
    const triggersToCreate = [];
    const actionsToCreate = [];

    for (const ch of channels) {
        const type = triggerMap[ch];
        if (type) {
            triggersToCreate.push({
                workflowId: workflow.id,
                type,
                configJson: {
                    matchMode: 'contains',
                    keywords: [],
                    // If this is FEED_COMMENT and we have a specific media ID
                    posts: (type === 'FEED_COMMENT' && feedConfig?.targetMediaId)
                        ? [feedConfig.targetMediaId]
                        : []
                }
            });
        }

        // We usually have 1 Action for the workflow overall? Or per channel?
        // Prompt says "Action message text (reply template)". Usually 1 common reply or specific?
        // Let's create one Action per channel-type logic OR just one generic action if possible.
        // But FEED uses REPLY_COMMENT, DM uses SEND_DM.
        // So we might need separate actions or a single action that handles the context.
        // For simplicity: Create one action of type matching the FIRST channel, 
        // OR better: The editor allows configuring "Reply".
        // Let's create one Action. The Processor will pick the first action.

        // If we have mixed channels (Feed + DM), we need an action that works for both?
        // Usually you reply with text.
        // Let's create one default action "SEND_REPLY" (generic code logic handled in processor).
        // My schema has 'SEND_DM', 'REPLY_COMMENT'.
        // I'll create one Action per supported output type if needed, or just 1 action and processor casts it.
        // I will create 1 Action row with type 'SEND_DM' (default) and let processor adapt if it's a comment.
    }

    if (channels.length > 0) {
        actionsToCreate.push({
            workflowId: workflow.id,
            type: 'SEND_DM', // Default placeholder
            configJson: {
                replyMessage: "Olá! Como posso ajudar?"
            }
        });
    }

    if (triggersToCreate.length > 0) {
        await prisma.workflowTrigger.createMany({ data: triggersToCreate });
    }
    if (actionsToCreate.length > 0) {
        await prisma.workflowAction.createMany({ data: actionsToCreate });
    }

    return NextResponse.json(workflow);
}
