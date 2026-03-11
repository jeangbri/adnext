import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";

// ─── GET /api/workflows/:id ─────────────────────────────────────────────
// Returns the flow root rule + all child rules sharing the same flowRootId
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspace = await getPrimaryWorkspace(user.id, user.email || '');

    // Fetch root rule
    const root = await prisma.automationRule.findFirst({
        where: {
            id: params.id,
            workspaceId: workspace.id,
            triggerConfig: { path: ['isBroadcastFlow'], equals: true }
        },
        include: {
            actions: { orderBy: { order: 'asc' } },
            page: { select: { pageName: true, pageId: true } }
        }
    });

    if (!root) {
        return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    // Fetch all child nodes (rules where flowRootId === root.id)
    const children = await prisma.automationRule.findMany({
        where: {
            workspaceId: workspace.id,
            triggerConfig: { path: ['flowRootId'], equals: root.id }
        },
        include: {
            actions: { orderBy: { order: 'asc' } }
        }
    });

    // Calculate Stats (Lead Tracking per Node)
    const allRuleIds = [root.id, ...children.map(c => c.id)];

    const executions = await prisma.ruleExecution.groupBy({
        by: ['ruleId'],
        where: { ruleId: { in: allRuleIds } },
        _count: { ruleId: true }
    });

    // Map stats by ruleId
    const stats: Record<string, number> = {};
    allRuleIds.forEach(id => stats[id] = 0); // Default to 0
    executions.forEach(e => {
        stats[e.ruleId] = e._count.ruleId;
    });

    return NextResponse.json({ root, children, stats });
}

// ─── PATCH /api/workflows/:id ───────────────────────────────────────────
// Toggle isActive or change pageId for all rules of this flow
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspace = await getPrimaryWorkspace(user.id, user.email || '');
    const { isActive, pageId } = await req.json();

    // Verify ownership
    const root = await prisma.automationRule.findFirst({
        where: {
            id: params.id,
            workspaceId: workspace.id,
            triggerConfig: { path: ['isBroadcastFlow'], equals: true }
        }
    });

    if (!root) {
        return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    const dataToUpdate: any = {};
    if (typeof isActive !== 'undefined') dataToUpdate.isActive = isActive;
    if (typeof pageId !== 'undefined') {
        dataToUpdate.pageId = pageId;
        dataToUpdate.pageIds = pageId ? [pageId] : [];
    }

    if (Object.keys(dataToUpdate).length > 0) {
        // Toggle root + all child rules
        await prisma.automationRule.update({
            where: { id: params.id },
            data: dataToUpdate
        });

        // Update children (rules with flowRootId = this id)
        const children = await prisma.automationRule.findMany({
            where: {
                workspaceId: workspace.id,
                triggerConfig: { path: ['flowRootId'], equals: params.id }
            },
            select: { id: true }
        });

        if (children.length > 0) {
            await prisma.automationRule.updateMany({
                where: { id: { in: children.map(c => c.id) } },
                data: dataToUpdate
            });
        }
    }

    return NextResponse.json({ ok: true, isActive, pageId });
}

// ─── PUT /api/workflows/:id ─────────────────────────────────────────────
// Fully updates a workflow by updating the root rule and recreating children
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspace = await getPrimaryWorkspace(user.id, user.email || '');
    const body = await req.json().catch(() => ({}));
    const { name, pageId, nodes, edges } = body;

    // Verify ownership
    const rootId = params.id;
    const existingRoot = await prisma.automationRule.findFirst({
        where: { id: rootId, workspaceId: workspace.id, triggerConfig: { path: ['isBroadcastFlow'], equals: true } }
    });

    if (!existingRoot) {
        return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    try {
        const nodesList = Array.isArray(nodes) ? nodes : [];
        const edgesList = Array.isArray(edges) ? edges : [];

        // Identify new logical root configuration
        const startNode = nodesList.find((n: any) => n?.type === 'startNode');
        const startNodeId = startNode?.id;
        const startEdge = startNodeId ? edgesList.find((e: any) => e?.source === startNodeId) : null;
        const targetOfStartId = startEdge?.target;

        const actionableNodes = nodesList.filter((n: any) =>
            n?.type === 'broadcastNode' || n?.type === 'conditionNode' || n?.type === 'delayNode'
        );

        // 1. Delete existing child rules and ALL actions for this flow
        const workspaceRules = await prisma.automationRule.findMany({
            where: { workspaceId: workspace.id },
            select: { id: true, triggerConfig: true }
        });

        const children = workspaceRules.filter((r: any) =>
            r.triggerConfig && r.triggerConfig.flowRootId === rootId
        );
        const childIds = children.map(c => c.id);
        const allIds = [rootId, ...childIds];

        await prisma.automationAction.deleteMany({ where: { ruleId: { in: allIds } } });
        // Clean up execution state for children (optional, but good for deep reset)
        if (childIds.length > 0) {
            await prisma.ruleExecution.deleteMany({ where: { ruleId: { in: childIds } } });
            await prisma.conversationState.deleteMany({ where: { ruleId: { in: childIds } } });
            await prisma.automationRule.deleteMany({ where: { id: { in: childIds } } });
        }

        const createdRules: Record<string, string> = {};

        let rootNodeId = targetOfStartId;
        if (!rootNodeId) {
            // fallback to the first actionable node if start doesn't point anywhere
            rootNodeId = actionableNodes[0]?.id || 'root';
        }

        // 2. Recreate rules and map node IDs
        for (const node of actionableNodes) {
            const isRootRule = node.id === rootNodeId;

            if (isRootRule) {
                // Update the existing root rule instead of creating a new one
                let triggerType = 'MESSAGE_ANY';
                let keywords: string[] = [];
                let matchType = 'CONTAINS';
                let triggerPayload = null;

                if (startNode?.data) {
                    triggerType = startNode.data.triggerType || 'MESSAGE_ANY';
                    keywords = startNode.data.keywords || [];
                    matchType = startNode.data.matchType || 'CONTAINS';
                    triggerPayload = startNode.data.triggerPayload || null;
                }

                await prisma.automationRule.update({
                    where: { id: rootId },
                    data: {
                        name: name || existingRoot.name,
                        keywords: keywords,
                        matchType: matchType,
                        triggerType: triggerType,
                        pageIds: pageId ? [pageId] : [],
                        pageId: pageId || null,
                        triggerConfig: {
                            isBroadcastFlow: true,
                            flowRootId: null,
                            canvas: { nodes: nodesList, edges: edgesList },
                            nodeId: node.id,
                            triggerPayload: triggerPayload
                        }
                    }
                });
                createdRules[node.id] = rootId;
            } else {
                // Create new child rule
                const childRule = await prisma.automationRule.create({
                    data: {
                        workspaceId: workspace.id,
                        name: `${name || existingRoot.name} - ${node.id}`,
                        keywords: [],
                        matchType: 'CONTAINS',
                        matchOperator: 'ANY',
                        priority: 10,
                        isActive: existingRoot.isActive, // inherit root active state
                        pageIds: pageId ? [pageId] : [],
                        pageId: pageId || null,
                        triggerType: 'MESSAGE_ANY',
                        triggerConfig: {
                            isBroadcastFlow: false,
                            flowRootId: rootId,
                            nodeId: node.id
                        }
                    }
                });
                createdRules[node.id] = childRule.id;
            }
        }

        // 3. Recreate Actions securely hooking buttons
        for (const node of actionableNodes) {
            const ruleId = createdRules[node.id];
            if (!ruleId) continue; // safety check

            if (node.type === 'broadcastNode') {
                const buttons = (node.data?.buttons || []).map((btn: any) => {
                    if (btn.actionType === 'flow_jump') {
                        const edge = edgesList.find((e: any) => e.source === node.id && e.sourceHandle === btn.id);
                        const edgeTargetId = edge ? edge.target : btn.targetNodeId;

                        if (edgeTargetId) {
                            const targetRuleId = createdRules[edgeTargetId];
                            return { ...btn, targetNodeId: edgeTargetId, value: targetRuleId || edgeTargetId };
                        }
                    }
                    return btn;
                });

                await prisma.automationAction.create({
                    data: {
                        ruleId,
                        type: 'MESSAGE_WITH_BUTTONS',
                        payload: {
                            message: node.data?.message || '',
                            buttons: buttons
                        },
                        order: 0,
                        delayMs: 0
                    }
                });
            }
        }

        return NextResponse.json({ ok: true, id: rootId });
    } catch (error: any) {
        console.error("Error updating workflow completely:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// ─── DELETE /api/workflows/:id ──────────────────────────────────────────
// Deletes the flow root + all child rules
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspace = await getPrimaryWorkspace(user.id, user.email || '');

    // Verify ownership (simplified to prevent JSON query errors)
    const root = await prisma.automationRule.findFirst({
        where: {
            id: params.id,
            workspaceId: workspace.id
        }
    });

    if (!root) {
        return NextResponse.json({ error: "Flow not found or access denied" }, { status: 404 });
    }

    // Find all child rule IDs by pulling workspace rules and filtering in memory (safest for JSON)
    const workspaceRules = await prisma.automationRule.findMany({
        where: { workspaceId: workspace.id },
        select: { id: true, triggerConfig: true }
    });

    const children = workspaceRules.filter((r: any) =>
        r.triggerConfig && r.triggerConfig.flowRootId === params.id
    );

    const allIds = [params.id, ...children.map(c => c.id)];

    try {
        // Delete actions then rules
        await prisma.automationAction.deleteMany({
            where: { ruleId: { in: allIds } }
        });

        await prisma.ruleExecution.deleteMany({
            where: { ruleId: { in: allIds } }
        });

        await prisma.messengerPage.updateMany({
            where: { defaultRuleId: { in: allIds } },
            data: { defaultRuleId: null }
        });

        await prisma.conversationState.deleteMany({
            where: { ruleId: { in: allIds } }
        });

        await prisma.automationRule.deleteMany({
            where: { id: { in: allIds } }
        });

        return NextResponse.json({ ok: true, deleted: allIds.length });
    } catch (error: any) {
        console.error("Error deleting workflow:", error);
        return NextResponse.json({ error: error.message || "Failed to delete workflow" }, { status: 500 });
    }
}
