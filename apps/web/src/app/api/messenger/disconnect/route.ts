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

        // Soft disconnect: Deactivate pages and clear tokens.
        // This hides them from the UI (since we filter isActive: true)
        // and prevents any background jobs from using the invalid tokens.
        // When user reconnects, the upsert will reactivate them with new tokens.

        await prisma.messengerPage.updateMany({
            where: {
                workspaceId: workspace.id
            },
            data: {
                isActive: false,
                pageAccessToken: "DISCONNECTED", // Clear the token
            }
        });

        return NextResponse.json({ success: true, message: "Disconnected successfully" });
    } catch (e: any) {
        console.error("Disconnect Error:", e);
        return NextResponse.json({ error: e.message || "Failed to disconnect" }, { status: 500 });
    }
}
