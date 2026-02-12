"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus, Zap, Edit } from "lucide-react"
import { DeleteRuleButton } from "./_components/delete-button"
import { Skeleton } from "@/components/ui/skeleton"

export default function AutomationsPage() {
    const [rules, setRules] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const fetchRules = useCallback(async () => {
        try {
            const res = await fetch('/api/automations')
            if (res.ok) {
                const data = await res.json()
                setRules(data)
            }
        } catch (e) {
            console.error("Failed to load automations", e)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchRules()
    }, [fetchRules])

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
                {loading ? (
                    /* Table skeleton */
                    <div>
                        <div className="bg-zinc-900/50 border-b border-white/5 px-6 py-4 flex gap-8">
                            {["w-20", "w-32", "w-16", "w-12", "w-16", "w-16"].map((w, i) => (
                                <Skeleton key={i} className={`h-4 ${w} bg-zinc-800`} />
                            ))}
                        </div>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="px-6 py-4 flex items-center gap-8 border-b border-white/5 last:border-0">
                                <Skeleton className="h-4 w-28 bg-zinc-800" />
                                <div className="flex gap-1.5">
                                    <Skeleton className="h-5 w-14 rounded-full bg-zinc-800" />
                                    <Skeleton className="h-5 w-18 rounded-full bg-zinc-800" />
                                </div>
                                <Skeleton className="h-4 w-8 bg-zinc-800" />
                                <Skeleton className="h-4 w-16 bg-zinc-800" />
                                <Skeleton className="h-5 w-14 rounded-full bg-zinc-800" />
                                <div className="ml-auto flex gap-2">
                                    <Skeleton className="h-8 w-8 rounded bg-zinc-800" />
                                    <Skeleton className="h-8 w-8 rounded bg-zinc-800" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : rules.length === 0 ? (
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
                                            {rule.triggerType && rule.triggerType !== 'MESSAGE_ANY' && (
                                                <span className={`px-2 py-0.5 w-fit rounded text-[10px] font-bold uppercase
                                                    ${rule.triggerType === 'COMMENT_ON_POST' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' :
                                                        rule.triggerType === 'MESSAGE_OUTSIDE_24H' ? 'bg-orange-500/20 text-orange-500 border border-orange-500/30' :
                                                            'bg-zinc-800 text-zinc-400'}
                                                `}>
                                                    {rule.triggerType === 'COMMENT_ON_POST' ? 'Comentário' :
                                                        rule.triggerType === 'MESSAGE_OUTSIDE_24H' ? 'Reengajamento (>24h)' :
                                                            rule.triggerType}
                                                </span>
                                            )}
                                            <div className="flex flex-wrap gap-1">
                                                {rule.keywords.length > 0 ? rule.keywords.slice(0, 3).map((k: string, i: number) => (
                                                    <span key={i} className="px-2 py-0.5 rounded-full bg-zinc-800 text-xs border border-white/5">
                                                        {k}
                                                    </span>
                                                )) : (
                                                    rule.triggerType === 'MESSAGE_OUTSIDE_24H' ?
                                                        <span className="text-xs text-zinc-500 italic">Qualquer msg</span> :
                                                        rule.triggerType === 'COMMENT_ON_POST' && rule.triggerConfig?.keywords?.length === 0 ?
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
                                        {rule.actions?.length ?? 0} ações
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
