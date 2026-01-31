import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryWorkspace } from "@/lib/workspace";
import { decrypt } from "@/lib/encryption";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspace = await getPrimaryWorkspace(user.id, user.email || '');

    const body = await req.json().catch(() => ({}));
    const { pageId } = body;

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

    if (!page) return NextResponse.json({ error: "Page not found or not active" }, { status: 404 });

    // Find last contact
    const contact = await prisma.contact.findFirst({
        where: { workspaceId: workspace.id },
        orderBy: { lastSeenAt: 'desc' }
    });

    if (!contact) {
        return NextResponse.json({ error: "Nenhum contato encontrado para teste. Envie uma mensagem para a página primeiro." }, { status: 404 });
    }

    try {
        const token = decrypt(page.pageAccessToken);
        const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`;

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: { id: contact.psid },
                message: { text: "Teste AdNext: Integração funcionando! 🚀" }
            })
        });

        const data = await res.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        return NextResponse.json({ success: true, recipient: contact.firstName || contact.psid });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
