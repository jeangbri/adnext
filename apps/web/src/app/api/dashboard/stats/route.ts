import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryWorkspace } from "@/lib/workspace";
import { getScopedContext } from "@/lib/user-scope";
import { getDashboardStats } from "@/lib/dashboard-service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [workspace, scope] = await Promise.all([
        getPrimaryWorkspace(user.id, user.email || ''),
        getScopedContext(user.id)
    ]);

    const { searchParams } = new URL(req.url);
    const paramPageId = searchParams.get('pageId');

    let targetPageId = paramPageId || (scope?.pageId === 'ALL' ? undefined : (scope?.pageId ?? undefined));

    const targetPageIds = (!targetPageId && scope?.pageIds && scope.pageIds.length > 0)
        ? scope.pageIds
        : undefined;

    const stats = await getDashboardStats(workspace.id, targetPageId, targetPageIds);

    return NextResponse.json(stats);
}
