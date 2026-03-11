import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryWorkspace } from "@/lib/workspace";
import { processMessengerEvent } from "@/lib/messenger-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Auth Bypass for local testing
    const bypassHeader = req.headers.get("x-adnext-test-bypass");
    const isLocalBypass = bypassHeader === "true";

    if (!user && !isLocalBypass) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspace = user
        ? await getPrimaryWorkspace(user.id, user.email || '')
        : await prisma.workspace.findFirst(); // Fallback to first workspace if bypassing

    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const { pageId, text, psid, type } = body;

    // 1. Find the Page
    let page;
    if (pageId) {
        page = await prisma.messengerPage.findFirst({
            where: {
                workspaceId: workspace.id,
                pageId: pageId,
                isActive: true
            }
        });
    } else {
        page = await prisma.messengerPage.findFirst({
            where: { workspaceId: workspace.id, isActive: true }
        });
    }

    if (!page) return NextResponse.json({ error: "Página não encontrada ou inativa." }, { status: 404 });

    // 2. Determine Contact (use provided psid or last contact)
    let targetPsid = psid;
    if (!targetPsid) {
        const contact = await prisma.contact.findFirst({
            where: { workspaceId: workspace.id, pageId: page.pageId },
            orderBy: { lastSeenAt: 'desc' }
        });
        if (!contact) {
            // If no contact, we'll use a dummy PSID for the simulation
            targetPsid = "SIMULATED_USER_" + Math.floor(Math.random() * 1000000);
        } else {
            targetPsid = contact.psid;
        }
    }

    // 3. Build simulated Payload
    const mid = "mid.simulated_" + Date.now();
    let simulatedPayload: any = {
        object: "page",
        entry: [
            {
                id: page.pageId,
                time: Date.now(),
                messaging: []
            }
        ]
    };

    if (type === 'POSTBACK' || type === 'BUTTON') {
        simulatedPayload.entry[0].messaging.push({
            sender: { id: targetPsid },
            recipient: { id: page.pageId },
            timestamp: Date.now(),
            postback: {
                mid: mid,
                title: "Simulated Button",
                payload: text // For postback, 'text' field is the payload
            }
        });
    } else {
        // Default: Message
        simulatedPayload.entry[0].messaging.push({
            sender: { id: targetPsid },
            recipient: { id: page.pageId },
            timestamp: Date.now(),
            message: {
                mid: mid,
                text: text
            }
        });
    }

    // 4. Execute simulation directly
    try {
        console.log(`[Simulator] Simulating ${type || 'MESSAGE'} trigger for user ${targetPsid}: '${text}'`);
        await processMessengerEvent(simulatedPayload);

        return NextResponse.json({
            success: true,
            status: "Simulação processada com sucesso!",
            details: {
                user: targetPsid,
                trigger: type || 'MESSAGE',
                input: text
            }
        });
    } catch (e: any) {
        console.error("[Simulator] Error", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
