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
// Toggle isActive for all rules of this flow
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspace = await getPrimaryWorkspace(user.id, user.email || '');
    const { isActive } = await req.json();

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

    // Toggle root + all child rules
    await prisma.automationRule.update({
        where: { id: params.id },
        data: { isActive }
    });

    // Update children (rules with flowRootId = this id)
    // Use raw update since Prisma doesn't support JSON path filter in `updateMany` in all versions
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
            data: { isActive }
        });
    }

    return NextResponse.json({ ok: true, isActive });
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
