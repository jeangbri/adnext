import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryWorkspace } from "@/lib/workspace";
import { decrypt } from "@/lib/encryption";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const workspace = await getPrimaryWorkspace(user.id, user.email || '');
        const body = await req.json();
        const { pageId, getStartedPayload, iceBreakers } = body;

        if (!pageId) return NextResponse.json({ error: "Page ID required" }, { status: 400 });

        const page = await prisma.messengerPage.findFirst({
            where: {
                workspaceId: workspace.id,
                pageId: pageId,
                isActive: true
            }
        });

        if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });

        // 1. Configure Messenger Profile via Graph API
        const token = decrypt(page.pageAccessToken);
        const url = `https://graph.facebook.com/v19.0/me/messenger_profile?access_token=${token}`;

        const fbBody: any = {};

        if (getStartedPayload) {
            fbBody.get_started = { payload: getStartedPayload };
        } else {
            // Should we delete it if empty? 
            // fbBody.get_started = null; // API might fail or delete. For now, assume we set it if provided.
        }

        if (iceBreakers && Array.isArray(iceBreakers)) {
            fbBody.ice_breakers = iceBreakers.map((ib: any) => ({
                question: ib.question,
                payload: ib.payload
            }));
        }

        if (Object.keys(fbBody).length > 0) {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fbBody)
            });

            const data = await res.json();
            if (!res.ok) {
                console.error("FB Profile Error:", data);
                return NextResponse.json({ error: data.error?.message || "Failed to update Facebook settings" }, { status: 400 });
            }
        }

        // 2. Update DB
        const updated = await prisma.messengerPage.update({
            where: { id: page.id },
            data: {
                getStartedPayload,
                iceBreakers: iceBreakers || []
            }
        });

        return NextResponse.json({ success: true, page: updated });

    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
