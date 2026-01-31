import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rule = await prisma.automationRule.findUnique({
        where: { id: params.id },
        include: { actions: { orderBy: { order: 'asc' } } }
    });

    if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(rule);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, keywords, matchType, matchOperator, priority, cooldownSeconds, isActive, actions, pageIds } = body;

    try {
        // Transaction to update rule and replace actions
        const updated = await prisma.$transaction(async (tx) => {
            // Update Rule fields
            await tx.automationRule.update({
                where: { id: params.id },
                data: {
                    name, keywords, matchType, matchOperator, priority, cooldownSeconds, isActive,
                    pageIds: pageIds || []
                }
            });

            // Delete old actions
            await tx.automationAction.deleteMany({
                where: { ruleId: params.id }
            });

            // Create new actions
            if (actions && actions.length > 0) {
                await tx.automationAction.createMany({
                    data: actions.map((a: any, index: number) => ({
                        ruleId: params.id,
                        type: a.type,
                        payload: a.payload,
                        delayMs: a.delayMs || 0,
                        order: index
                    }))
                });
            }

            return tx.automationRule.findUnique({
                where: { id: params.id },
                include: { actions: { orderBy: { order: 'asc' } } }
            });
        });

        return NextResponse.json(updated);
    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        await prisma.automationRule.delete({
            where: { id: params.id }
        });
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
