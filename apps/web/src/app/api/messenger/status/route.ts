import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const workspace = await getPrimaryWorkspace(user.id, user.email || '');

        // Fetch connected page
        const account = await prisma.messengerPage.findFirst({
            where: {
                workspaceId: workspace.id,
                isActive: true
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });

        return NextResponse.json({ account });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}
