import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspace = await getPrimaryWorkspace(user.id, user.email || '');

    try {
        const lead = await prisma.contact.findUnique({
            where: { id: params.id },
            select: { workspaceId: true }
        });

        if (!lead || lead.workspaceId !== workspace.id) {
            return NextResponse.json({ error: "Lead not found or unauthorized" }, { status: 404 });
        }

        await prisma.contact.delete({
            where: { id: params.id }
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("[API/leads/:id] DELETE Error:", e);
        return NextResponse.json(
            { error: e.message || "Internal error" },
            { status: 500 }
        );
    }
}
