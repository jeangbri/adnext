import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma"
import { getPrimaryWorkspace } from "@/lib/workspace"
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

    // Fetch Rules
    const rules = await prisma.automationRule.findMany({
        where: { workspaceId: workspace.id },
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
                        Nova Regra
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
                                        <div className="flex flex-wrap gap-1">
                                            {rule.keywords.slice(0, 3).map((k, i) => (
                                                <span key={i} className="px-2 py-0.5 rounded-full bg-zinc-800 text-xs border border-white/5">
                                                    {k}
                                                </span>
                                            ))}
                                            {rule.keywords.length > 3 && (
                                                <span className="text-xs text-zinc-500">+{rule.keywords.length - 3}</span>
                                            )}
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
