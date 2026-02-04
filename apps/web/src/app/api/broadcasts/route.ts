
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";

// POST /api/broadcasts - Create Campaign
export async function POST(req: NextRequest) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspace = await getPrimaryWorkspace(user.id, user.email || '');
    const body = await req.json();
    const {
        name, pageId, audienceType, sendMode, scheduledAt,
        policyMode, tag, messageType, payload
    } = body;

    // Validate Page
    if (pageId === 'all') {
        return NextResponse.json({ error: "Broadcast must be specific to a single page." }, { status: 400 });
    }

    try {
        const campaign = await prisma.broadcastCampaign.create({
            data: {
                workspaceId: workspace.id,
                pageId,
                name,
                status: sendMode === 'IMMEDIATE' ? 'SCHEDULED' : 'DRAFT', // IMMEDIATE goes to SCHEDULED so runner picks it up asap
                audienceType,
                sendMode,
                scheduledAt: sendMode === 'IMMEDIATE' ? new Date() : new Date(scheduledAt),
                policyMode,
                tag,
                messageType,
                payload
            }
        });

        if (sendMode === 'IMMEDIATE') {
            // Attempt to trigger runner immediately
            // We await it to ensure at least the first batch/audience gen starts
            try {
                const { processBroadcasts } = await import("@/lib/broadcast-runner");
                await processBroadcasts();
            } catch (err) {
                console.error("Trigger runner failed", err);
            }
        }

        return NextResponse.json(campaign);
    } catch (e: any) {
        console.error("Failed to create campaign", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// GET /api/broadcasts - List Campaigns
export async function GET(req: NextRequest) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspace = await getPrimaryWorkspace(user.id, user.email || '');
    const { searchParams } = new URL(req.url);
    const pageId = searchParams.get('pageId');

    const where: any = { workspaceId: workspace.id };
    if (pageId && pageId !== 'all') {
        where.pageId = pageId;
    }

    const campaigns = await prisma.broadcastCampaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { page: true }
    });

    return NextResponse.json(campaigns);
}
