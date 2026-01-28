import { prisma } from "@/lib/prisma"
import { getPrimaryWorkspace } from "@/lib/workspace"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"

export const dynamic = "force-dynamic";

export default async function LogsPage({ searchParams }: { searchParams: { status?: string } }) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/entrar')

    const workspace = await getPrimaryWorkspace(user.id, user.email || '')

    // Filters
    const where: any = {
        // We can't easily filter logs by workspace directly if they are linked to Page/Contact
        // But Page -> Workspace.
        // Prisma doesn't support deep relation filtering easily on many-to-many?
        // MessageLog -> MessengerPage -> Workspace.
        page: {
            workspaceId: workspace.id
        }
    }

    if (searchParams.status && searchParams.status !== 'ALL') {
        where.status = searchParams.status;
    }

    // Fetch Logs
    // @ts-ignore - Prisma Client typings might lag
    const logs = await prisma.messageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
            contact: true
        }
    })

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Logs do Messenger</h1>
                    <p className="text-muted-foreground">Histórico de mensagens e automações.</p>
                </div>
            </div>

            <div className="border border-white/10 rounded-lg bg-zinc-950/50 backdrop-blur overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-900/50 text-zinc-400 font-medium border-b border-white/5">
                        <tr>
                            <th className="px-6 py-4">Data</th>
                            <th className="px-6 py-4">Contato</th>
                            <th className="px-6 py-4">Direção</th>
                            <th className="px-6 py-4">Conteúdo</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Erro</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-zinc-300">
                        {logs.map((log: any) => (
                            <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {new Date(log.createdAt).toLocaleString('pt-BR')}
                                </td>
                                <td className="px-6 py-4">
                                    {log.contact?.firstName || log.contact?.psid || 'Desconhecido'}
                                </td>
                                <td className="px-6 py-4">
                                    <Badge variant="outline" className={log.direction === 'IN' ? 'text-blue-400 bg-blue-400/10' : 'text-purple-400 bg-purple-400/10'}>
                                        {log.direction}
                                    </Badge>
                                </td>
                                <td className="px-6 py-4 max-w-xs truncate">
                                    {log.incomingText || (log.actionType ? `Action: ${log.actionType}` : '-')}
                                </td>
                                <td className="px-6 py-4">
                                    <Badge variant="secondary" className={
                                        log.status === 'ERROR' ? 'bg-red-500/10 text-red-500' :
                                            log.status === 'MATCHED' ? 'bg-green-500/10 text-green-500' :
                                                'bg-zinc-800 text-zinc-400'
                                    }>
                                        {log.status}
                                    </Badge>
                                </td>
                                <td className="px-6 py-4 text-red-400 max-w-xs truncate">
                                    {log.error}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {logs.length === 0 && (
                    <div className="p-12 text-center text-zinc-500">Nenhum log encontrado.</div>
                )}
            </div>
        </div>
    )
}
