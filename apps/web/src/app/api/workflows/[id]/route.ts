import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Check ownership
    const workflow = await prisma.workflow.findUnique({
        where: { id: params.id },
        include: {
            workspace: {
                select: {
                    members: {
                        where: { userId: user.id }
                    }
                }
            }
        }
    });

    if (!workflow || workflow.workspace.members.length === 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const triggers = await prisma.workflowTrigger.findMany({ where: { workflowId: params.id } });
    const actions = await prisma.workflowAction.findMany({ where: { workflowId: params.id } });

    return NextResponse.json({ workflow, triggers, actions });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { workflow: workflowUpdate, triggers, actions } = body;

    // TODO: Verify ownership again

    // Update Workflow
    if (workflowUpdate) {
        await prisma.workflow.update({
            where: { id: params.id },
            data: {
                status: workflowUpdate.status,
                isActive: workflowUpdate.isActive,
                flowDefinition: workflowUpdate.flowDefinition,
                updatedAt: new Date(),
                publishedAt: workflowUpdate.status === 'PUBLISHED' ? new Date() : undefined
            }
        });

        // SYNC: If flowDefinition is provided, sync triggers and actions tables
        if (workflowUpdate.flowDefinition) {
            const { nodes } = workflowUpdate.flowDefinition;

            // 1. Sync Triggers
            const triggerNodes = nodes.filter((n: any) => n.type === 'trigger' || n.type === 'trigger_comment' || n.type === 'trigger_mention');
            if (triggerNodes.length > 0) {
                // Delete existing triggers and recreate based on graph
                await prisma.workflowTrigger.deleteMany({ where: { workflowId: params.id } });
                await prisma.workflowTrigger.createMany({
                    data: triggerNodes.map((n: any) => {
                        const config = n.data.config || {};
                        return {
                            workflowId: params.id,
                            type: n.data.type || (n.type === 'trigger_comment' ? 'FEED_COMMENT' : n.type === 'trigger_mention' ? 'STORY_REPLY' : 'DM_RECEIVED'),
                            configJson: {
                                keywords: config.keyword ? [config.keyword.toLowerCase().trim()] : [],
                                matchMode: config.matchType || 'contains'
                            }
                        };
                    })
                });
            }

            // 2. Sync Actions
            const actionNodes = nodes.filter((n: any) => ['instagram', 'ai_response', 'webhook'].includes(n.type));
            if (actionNodes.length > 0) {
                await prisma.workflowAction.deleteMany({ where: { workflowId: params.id } });
                await prisma.workflowAction.createMany({
                    data: actionNodes.map((n: any) => {
                        const content = n.data.content || {};
                        const data = n.data || {};

                        // Map node data to what instagram-service.ts expects
                        let type = 'SEND_DM';
                        let configJson: any = {};

                        if (n.type === 'instagram') {
                            type = 'SEND_DM';
                            configJson = {
                                replyMessage: content.message || '',
                                imageUrl: content.imageUrl || '',
                                buttons: content.buttons || [],
                                cta: content.cta || { enabled: false }
                            };
                        } else if (n.type === 'ai_response') {
                            type = 'AI_RESPONSE';
                            configJson = {
                                prompt: data.prompt || '',
                                model: data.model || 'gpt-4o-mini'
                            };
                        } else if (n.type === 'webhook') {
                            type = 'WEBHOOK';
                            configJson = {
                                url: data.url || '',
                                method: data.method || 'POST'
                            };
                        }

                        return {
                            workflowId: params.id,
                            type,
                            configJson
                        };
                    })
                });
            }
        }
    }

    // Legacy manual updates (kept for compatibility)
    if (triggers && !workflowUpdate?.flowDefinition) {
        for (const t of triggers) {
            await prisma.workflowTrigger.update({
                where: { id: t.id },
                data: { configJson: t.configJson }
            });
        }
    }

    // Update Actions
    if (actions) {
        for (const a of actions) {
            await prisma.workflowAction.update({
                where: { id: a.id },
                data: { configJson: a.configJson }
            });
        }
    }

    return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    const supabase = createClient();
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Check ownership
        const workflow = await prisma.workflow.findUnique({
            where: { id: params.id },
            include: {
                workspace: {
                    select: {
                        members: {
                            where: { userId: user.id }
                        }
                    }
                }
            }
        });

        if (!workflow || workflow.workspace.members.length === 0) {
            return NextResponse.json({ error: "Not found or not authorized" }, { status: 404 });
        }

        // Delete related data first
        await prisma.workflowTrigger.deleteMany({ where: { workflowId: params.id } });
        await prisma.workflowAction.deleteMany({ where: { workflowId: params.id } });
        await prisma.automationRun.deleteMany({ where: { workflowId: params.id } });

        await prisma.workflow.delete({
            where: { id: params.id }
        });

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error("Delete workflow error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
