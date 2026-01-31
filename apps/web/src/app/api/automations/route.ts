import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspace = await getPrimaryWorkspace(user.id, user.email || '');

    const rules = await prisma.automationRule.findMany({
        where: { workspaceId: workspace.id },
        include: { actions: { orderBy: { order: 'asc' } } },
        orderBy: { priority: 'desc' }
    });

    return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspace = await getPrimaryWorkspace(user.id, user.email || '');
    const body = await req.json();

    const { name, keywords, matchType, matchOperator, priority, cooldownSeconds, isActive, actions, pageIds } = body;

    try {
        const rule = await prisma.automationRule.create({
            data: {
                workspaceId: workspace.id,
                name,
                keywords: keywords || [],
                matchType: matchType || 'CONTAINS',
                matchOperator: matchOperator || 'ANY',
                priority: priority || 0,
                cooldownSeconds: cooldownSeconds || 0,
                isActive: isActive !== undefined ? isActive : true,
                pageIds: pageIds || [],
                actions: {
                    create: (actions || []).map((a: any, index: number) => ({
                        type: a.type,
                        payload: a.payload,
                        delayMs: a.delayMs || 0,
                        order: index
                    }))
                }
            },
            include: { actions: true }
        });

        return NextResponse.json(rule);
    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
