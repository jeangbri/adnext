
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryWorkspace } from "@/lib/workspace";
import { decrypt } from "@/lib/encryption";

const FB_API_URL = "https://graph.facebook.com/v19.0";

export async function GET(req: NextRequest, { params }: { params: { pageId: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspace = await getPrimaryWorkspace(user.id, user.email || '');

    // Verify Page Ownership
    const page = await prisma.messengerPage.findUnique({
        where: { pageId: params.pageId, workspaceId: workspace.id }
    });

    if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });

    try {
        const token = decrypt(page.pageAccessToken);
        // Fetch posts (limit 20)
        // Fields: id, message, created_time, full_picture, permalink_url
        const url = `${FB_API_URL}/${page.pageId}/posts?fields=id,message,created_time,full_picture,permalink_url,status_type&limit=20&access_token=${token}`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.error) {
            return NextResponse.json({ error: data.error.message }, { status: 400 });
        }

        return NextResponse.json({ posts: data.data });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
