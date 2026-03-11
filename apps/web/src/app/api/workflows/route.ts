import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";

// List all broadcast flow rules (roots)
export async function GET(req: NextRequest) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspace = await getPrimaryWorkspace(user.id, user.email || '');

    const rules = await prisma.automationRule.findMany({
        where: {
            workspaceId: workspace.id,
            triggerConfig: { path: ['isBroadcastFlow'], equals: true }
        },
        include: {
            actions: { orderBy: { order: 'asc' } },
            page: { select: { pageName: true, pageId: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(rules);
}

// Create a new broadcast flow root
export async function POST(req: NextRequest) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspace = await getPrimaryWorkspace(user.id, user.email || '');
    const body = await req.json().catch(() => ({}));
    const { name, pageId, nodes, edges } = body;

    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    try {
        const nodesList = Array.isArray(nodes) ? nodes : [];
        const edgesList = Array.isArray(edges) ? edges : [];

        // 1. Identify "logical root" (the node StartNode points to)
        const startNode = nodesList.find((n: any) => n?.type === 'startNode');
        const startNodeId = startNode?.id;

        const startEdge = startNodeId ? edgesList.find((e: any) => e?.source === startNodeId) : null;
        const targetOfStartId = startEdge?.target;

        // map of nodeId -> ruleId
        const createdRules: Record<string, string> = {};

        // Filter nodes that need a database rule (Broadcast, Condition, Delay)
        const actionableNodes = nodesList.filter((n: any) =>
            n?.type === 'broadcastNode' || n?.type === 'conditionNode' || n?.type === 'delayNode'
        );

        // First pass: create all rules
        for (const node of actionableNodes) {
            const isRootRule = node.id === targetOfStartId || (!targetOfStartId && node.id === 'root');

            let triggerType = 'MESSAGE_ANY';
            let keywords: string[] = [];
            let matchType = 'CONTAINS';
            let triggerPayload = null;

            if (isRootRule && startNode?.data) {
                triggerType = startNode.data.triggerType || 'MESSAGE_ANY';
                keywords = startNode.data.keywords || [];
                matchType = startNode.data.matchType || 'CONTAINS';
                triggerPayload = startNode.data.triggerPayload || null;
            }

            const rule = await prisma.automationRule.create({
                data: {
                    workspaceId: workspace.id,
                    name: isRootRule ? name : `${name} - ${node.id}`,
                    keywords: keywords,
                    matchType: matchType,
                    matchOperator: 'ANY',
                    priority: isRootRule ? 100 : 10,
                    cooldownSeconds: 0,
                    isActive: false,
                    pageIds: pageId ? [pageId] : [],
                    pageId: pageId || null,
                    triggerType: triggerType,
                    triggerConfig: isRootRule ? {
                        isBroadcastFlow: true, // Legacy flag logic
                        flowRootId: null,
                        canvas: { nodes: nodesList, edges: edgesList }, // Store full UI state here!
                        nodeId: node.id,
                        triggerPayload: triggerPayload
                    } : {
                        isBroadcastFlow: false,
                        flowRootId: null,
                        nodeId: node.id
                    },
                }
            });
            createdRules[node.id] = rule.id;
        }

        // Find the newly created root rule ID
        const rootRuleId = targetOfStartId ? createdRules[targetOfStartId] : (createdRules['root'] || Object.values(createdRules)[0]);

        // Second pass: create actions with resolved links
        for (const node of actionableNodes) {
            const ruleId = createdRules[node.id];

            if (node.type === 'broadcastNode') {
                const buttons = (node.data?.buttons || []).map((btn: any) => {
                    if (btn.actionType === 'flow_jump') {
                        // Find the edge that connects this button to another node
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
            // TODO: Add support for condition actions and delay actions to runner
        }

        // Update children with flowRootId
        if (rootRuleId) {
            const childNodeIds = actionableNodes
                .filter((n: any) => createdRules[n.id] !== rootRuleId)
                .map((n: any) => n.id);

            if (childNodeIds.length > 0) {
                await prisma.automationRule.updateMany({
                    where: { id: { in: childNodeIds.map(id => createdRules[id]) } },
                    data: {
                        triggerConfig: {
                            isBroadcastFlow: false,
                            flowRootId: rootRuleId
                        }
                    }
                });
            }
        }

        const rootRule = await prisma.automationRule.findUnique({
            where: { id: rootRuleId },
            include: { actions: { orderBy: { order: 'asc' } } }
        });

        return NextResponse.json({ rule: rootRule, ruleMap: createdRules });
    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
