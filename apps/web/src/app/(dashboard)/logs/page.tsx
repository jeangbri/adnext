import { prisma } from "@/lib/prisma"
import { getPrimaryWorkspace } from "@/lib/workspace"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { getScopedContext } from "@/lib/user-scope"

export const dynamic = "force-dynamic";

export default async function LogsPage({ searchParams }: { searchParams: { status?: string, pageId?: string } }) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/entrar')

    // Parallel: workspace + scope
    const [workspace, scope] = await Promise.all([
        getPrimaryWorkspace(user.id, user.email || ''),
        getScopedContext(user.id)
    ])

    // Determine Page Filter
    let targetPageIds: string[] = [];

    if (searchParams.pageId && searchParams.pageId !== 'ALL') {
        targetPageIds = [searchParams.pageId];
    } else if (scope?.pageIds && scope.pageIds.length > 0) {
        targetPageIds = scope.pageIds;
    }

    const contextFilter = (targetPageIds.length > 0)
        ? { pageId: { in: targetPageIds } }
        : { page: { workspaceId: workspace.id } };

    const whereLog: any = {
        page: { workspaceId: workspace.id },
        ...contextFilter
    }
    const whereComment: any = {
        page: { workspaceId: workspace.id },
        ...contextFilter
    }

    if (searchParams.status && searchParams.status !== 'ALL') {
        whereLog.status = searchParams.status;
    }

    // Parallel Fetch
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
        (!searchParams.status || searchParams.status === 'ALL') ? prisma.commentEvent.findMany({
            where: whereComment,
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: { page: { select: { pageName: true } } }
        }) : []
    ]);

    // Unify & Sort
    const unifiedLogs = [
        ...messageLogs.map((l: any) => ({
            id: l.id,
            type: 'MESSAGE',
            direction: l.direction,
            source: l.actionType ? 'AUTOMATION' : 'WEBHOOK',
            content: l.incomingText || (l.actionType ? `Envio: ${l.actionType}` : '-'),
            status: l.status,
            error: l.error,
            createdAt: l.createdAt,
            pageName: l.page.pageName,
            contactName: l.contact?.firstName || l.contact?.psid || 'Desconhecido',
        })),
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
        }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 50);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Logs & Eventos</h1>
                    <p className="text-muted-foreground">Histórico unificado de mensagens e comentários.</p>
                </div>
            </div>

            <div className="border border-white/10 rounded-lg bg-zinc-950/50 backdrop-blur overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-900/50 text-zinc-400 font-medium border-b border-white/5">
                        <tr>
                            <th className="px-6 py-4">Data</th>
                            <th className="px-6 py-4">Página</th>
                            <th className="px-6 py-4">Origem</th>
                            <th className="px-6 py-4">Tipo</th>
                            <th className="px-6 py-4">Conteúdo</th>
                            <th className="px-6 py-4">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-zinc-300">
                        {unifiedLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-xs text-zinc-400">
                                    {new Date(log.createdAt).toLocaleString('pt-BR')}
                                </td>
                                <td className="px-6 py-4 text-xs">
                                    {log.pageName}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-sm">{log.contactName}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <Badge variant="outline" className={`
                                        ${log.type === 'COMMENT' ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' : ''}
                                        ${log.type === 'MESSAGE' && log.direction === 'IN' ? 'text-blue-400 bg-blue-400/10 border-blue-400/20' : ''}
                                        ${log.type === 'MESSAGE' && log.direction === 'OUT' ? 'text-purple-400 bg-purple-400/10 border-purple-400/20' : ''}
                                    `}>
                                        {log.type === 'COMMENT' ? 'COMENTÁRIO' : (log.direction === 'IN' ? 'MSG RECEBIDA' : 'MSG ENVIADA')}
                                    </Badge>
                                </td>
                                <td className="px-6 py-4 max-w-xs truncate" title={log.content}>
                                    {log.content}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1">
                                        <Badge variant="secondary" className={
                                            log.status === 'ERROR' || log.status === 'FAILED' ? 'bg-red-500/10 text-red-500' :
                                                log.status === 'MATCHED' || log.status === 'SENT' || log.status === 'RECEIVED' ? 'bg-green-500/10 text-green-500' :
                                                    'bg-zinc-800 text-zinc-400'
                                        }>
                                            {log.status}
                                        </Badge>
                                        {log.error && <span className="text-[10px] text-red-400 max-w-[150px] truncate">{log.error}</span>}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {unifiedLogs.length === 0 && (
                    <div className="p-12 text-center text-zinc-500">Nenhum log encontrado.</div>
                )}
            </div>
        </div>
    )
}
