import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const workspace = await getPrimaryWorkspace(user.id, user.email || '');

        // 1. Find all pages for this workspace
        const pages = await prisma.messengerPage.findMany({
            where: { workspaceId: workspace.id },
            select: { pageId: true }
        });

        const pageIds = pages.map(p => p.pageId);

        if (pageIds.length === 0) {
            return NextResponse.json({ success: true, message: "No pages to disconnect" });
        }

        // 2. Perform cleanup in transaction
        await prisma.$transaction([
            // Delete ephemeral state
            prisma.conversationState.deleteMany({ where: { pageId: { in: pageIds } } }),

            // Delete logs (history) - Destructive but necessary for clean disconnect
            prisma.messageLog.deleteMany({ where: { pageId: { in: pageIds } } }),

            // Delete campaigns - Destructive
            prisma.broadcastCampaign.deleteMany({ where: { pageId: { in: pageIds } } }),

            // Detach Contacts (Keep the lead, remove the page link)
            prisma.contact.updateMany({
                where: { pageId: { in: pageIds } },
                data: { pageId: null }
            }),

            // Detach Rule Executions
            prisma.ruleExecution.updateMany({
                where: { pageId: { in: pageIds } },
                data: { pageId: null }
            }),

            // Finally delete the pages
            prisma.messengerPage.deleteMany({ where: { workspaceId: workspace.id } })
        ]);

        return NextResponse.json({ success: true, message: "Disconnected successfully" });
    } catch (e: any) {
        console.error("Disconnect Error:", e);
        return NextResponse.json({ error: e.message || "Failed to disconnect" }, { status: 500 });
    }
}
