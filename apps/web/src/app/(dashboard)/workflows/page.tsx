import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma"
import { getPrimaryWorkspace } from "@/lib/workspace"
import { getScopedContext } from "@/lib/user-scope"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus, Zap, Trash2, Edit } from "lucide-react"
import { redirect } from "next/navigation"
import { DeleteRuleButton } from "./_components/delete-button"

export const dynamic = "force-dynamic";

export default async function AutomationsPage() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/entrar')

    const workspace = await getPrimaryWorkspace(user.id, user.email || '')
    const scope = await getScopedContext()
    const workspaceId = workspace.id

    // Construct robust filter
    let whereClause: any = { workspaceId }

    if (scope?.projectId) {
        // If we are in a Project context
        if (scope.pageId && scope.pageId !== 'ALL') {
            // Specific Page Selected
            whereClause.OR = [
                { pageId: scope.pageId },                 // New single field
                { pageIds: { has: scope.pageId } },       // Old array field
                { AND: [{ pageId: null }, { pageIds: { equals: [] } }] } // Global rules
            ]
        } else {
            // "All Pages" of the Project
            const projectPageIds = scope.pageIds || []

            if (projectPageIds.length > 0) {
                whereClause.OR = [
                    { pageId: { in: projectPageIds } },
                    { pageIds: { hasSome: projectPageIds } },
                    { AND: [{ pageId: null }, { pageIds: { equals: [] } }] }
                ]
            } else {
                // Project has no pages yet? Show only global
                whereClause.OR = [
                    { AND: [{ pageId: null }, { pageIds: { equals: [] } }] }
                ]
            }
        }
    } else {
        // No project selected (Legacy View or "No Project" view)
        // Show everything for workspace? Or just globals?
        // Let's show everything to be safe for now.
    }

    // Fetch Rules
    const rules = await prisma.automationRule.findMany({
        where: whereClause,
        orderBy: { priority: 'desc' },
        include: { actions: true }
    })

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Automações</h1>
                    <p className="text-muted-foreground">Gerencie suas regras de resposta automática para o Messenger.</p>
                </div>
                <Link href="/workflows/create">
                    <Button className="bg-[#0084FF] hover:bg-[#0070D1] text-white gap-2 shadow-lg shadow-blue-500/20">
                        <Plus className="w-4 h-4" />
                        Criar Regra
                    </Button>
                </Link>
            </div>

            <div className="border border-white/10 rounded-lg bg-zinc-950/50 backdrop-blur overflow-hidden">
                {rules.length === 0 ? (
                    <div className="p-12 text-center space-y-4">
                        <div className="mx-auto w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center">
                            <Zap className="w-6 h-6 text-zinc-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-white">Nenhuma regra encontrada</h3>
                            <p className="text-zinc-500 text-sm">Crie sua primeira automação por palavra-chave.</p>
                        </div>
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-900/50 text-zinc-400 font-medium border-b border-white/5">
                            <tr>
                                <th className="px-6 py-4">Nome</th>
                                <th className="px-6 py-4">Gatilho (Keywords)</th>
                                <th className="px-6 py-4">Prioridade</th>
                                <th className="px-6 py-4">Ações</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Opções</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-zinc-300">
                            {rules.map((rule) => (
                                <tr key={rule.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 font-medium text-white">
                                        {rule.name}
                                    </td>
                                    <td className="px-6 py-4 max-w-xs truncate">
                                        <div className="flex flex-col gap-2">
                                            {/* Trigger Type Badge */
                                                (rule as any).triggerType && (rule as any).triggerType !== 'MESSAGE_ANY' && (
                                                    <span className={`px-2 py-0.5 w-fit rounded text-[10px] font-bold uppercase
                                                    ${(rule as any).triggerType === 'COMMENT_ON_POST' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' :
                                                            (rule as any).triggerType === 'MESSAGE_OUTSIDE_24H' ? 'bg-orange-500/20 text-orange-500 border border-orange-500/30' :
                                                                'bg-zinc-800 text-zinc-400'}
                                                `}>
                                                        {(rule as any).triggerType === 'COMMENT_ON_POST' ? 'Comentário' :
                                                            (rule as any).triggerType === 'MESSAGE_OUTSIDE_24H' ? 'Reengajamento (>24h)' :
                                                                (rule as any).triggerType}
                                                    </span>
                                                )}

                                            {/* Keywords */}
                                            <div className="flex flex-wrap gap-1">
                                                {rule.keywords.length > 0 ? rule.keywords.slice(0, 3).map((k, i) => (
                                                    <span key={i} className="px-2 py-0.5 rounded-full bg-zinc-800 text-xs border border-white/5">
                                                        {k}
                                                    </span>
                                                )) : (
                                                    (rule as any).triggerType === 'MESSAGE_OUTSIDE_24H' ?
                                                        <span className="text-xs text-zinc-500 italic">Qualquer msg</span> :
                                                        (rule as any).triggerType === 'COMMENT_ON_POST' && (rule as any).triggerConfig?.keywords?.length === 0 ?
                                                            <span className="text-xs text-zinc-500 italic">Qualquer comentário</span> :
                                                            <span className="text-xs text-zinc-600">-</span>
                                                )}
                                                {rule.keywords.length > 3 && (
                                                    <span className="text-xs text-zinc-500">+{rule.keywords.length - 3}</span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {rule.priority}
                                    </td>
                                    <td className="px-6 py-4">
                                        {rule.actions.length} ações
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${rule.isActive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                            {rule.isActive ? 'Ativo' : 'Pausado'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link href={`/workflows/${rule.id}`}>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 hover:text-white">
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                            </Link>
                                            <DeleteRuleButton ruleId={rule.id} />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
