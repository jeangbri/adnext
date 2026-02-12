import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryWorkspace } from "@/lib/workspace";
import { getScopedContext } from "@/lib/user-scope";

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
    const statusFilter = searchParams.get('status');

    // Determine Page Filter
    let targetPageIds: string[] = [];
    if (scope?.pageIds && scope.pageIds.length > 0) {
        targetPageIds = scope.pageIds;
    }

    const contextFilter = (targetPageIds.length > 0)
        ? { pageId: { in: targetPageIds } }
        : { page: { workspaceId: workspace.id } };

    const whereLog: any = {
        page: { workspaceId: workspace.id },
        ...contextFilter
    };
    const whereComment: any = {
        page: { workspaceId: workspace.id },
        ...contextFilter
    };

    if (statusFilter && statusFilter !== 'ALL') {
        whereLog.status = statusFilter;
    }

    const [messageLogs, commentEvents] = await Promise.all([
        prisma.messageLog.findMany({
            where: whereLog,
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
                contact: { select: { firstName: true, psid: true } },
                page: { select: { pageName: true } }
            }
        }),
        (!statusFilter || statusFilter === 'ALL') ? prisma.commentEvent.findMany({
            where: whereComment,
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: { page: { select: { pageName: true } } }
        }) : []
    ]);

    // Fetch Rule Names for IDs found in logs
    const ruleIds = messageLogs
        .map((l: any) => l.matchedRuleId)
        .filter((id: string) => id); // Filter nulls/undefined

    let ruleNameMap: Record<string, string> = {};
    if (ruleIds.length > 0) {
        const rules = await prisma.automationRule.findMany({
            where: { id: { in: ruleIds } },
            select: { id: true, name: true }
        });
        rules.forEach((r: any) => {
            ruleNameMap[r.id] = r.name;
        });
    }

    const unifiedLogs = [
        ...messageLogs.map((l: any) => {
            const ruleName = l.matchedRuleId ? (ruleNameMap[l.matchedRuleId] || 'Regra') : null;
            // Custom display for Fallback
            const displayStatus = l.status === 'MATCHED_FALLBACK' ? 'FALLBACK' : l.status;

            return {
                id: l.id,
                type: 'MESSAGE',
                direction: l.direction,
                source: l.actionType ? 'AUTOMATION' : 'WEBHOOK',
                content: l.incomingText || (l.actionType ? `Envio: ${l.actionType}` : '-'),
                status: displayStatus,
                error: l.error,
                createdAt: l.createdAt,
                pageName: l.page.pageName,
                contactName: l.contact?.firstName || l.contact?.psid || 'Desconhecido',
                ruleName: ruleName
            };
        }),
        ...commentEvents.map((c: any) => ({
            id: c.id,
            type: 'COMMENT',
            direction: 'IN',
            source: 'WEBHOOK_FEED',
            content: c.message || '[Sem texto]',
            status: 'RECEIVED',
            error: null,
            createdAt: c.createdAt,
            pageName: c.page.pageName,
            contactName: c.fromUserId || 'Usuário Facebook',
            ruleName: null
        }))
    ].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 50);

    return NextResponse.json(unifiedLogs);
}
