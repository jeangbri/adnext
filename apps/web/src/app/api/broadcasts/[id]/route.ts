
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspace = await getPrimaryWorkspace(user.id, user.email || '');

    const campaign = await prisma.broadcastCampaign.findUnique({
        where: { id: params.id, workspaceId: workspace.id },
        include: { page: true }
    });

    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    return NextResponse.json(campaign);
}

// Stats or Actions (Pause/Resume) can be added here
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const workspace = await getPrimaryWorkspace(user.id, user.email || '');

    const body = await req.json();
    const { status } = body;

    const campaign = await prisma.broadcastCampaign.update({
        where: { id: params.id, workspaceId: workspace.id },
        data: { status }
    });

    return NextResponse.json(campaign);
}
