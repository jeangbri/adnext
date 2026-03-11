"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, GitBranch, Clock, Users, Zap, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

export default function BroadcastFlowListPage() {
    const router = useRouter()
    const [flows, setFlows] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const fetchFlows = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/workflows')
            if (res.ok) {
                const data = await res.json()
                setFlows(data)
            }
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }

    useEffect(() => {
        fetchFlows()
    }, [])

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        if (!confirm("Tem certeza que deseja excluir esta regra? Todos os nós e ações associados serão removidos.")) return

        setDeletingId(id)
        try {
            const res = await fetch(`/api/workflows/${id}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                toast.success("Regra excluída com sucesso!")
                setFlows(flows.filter(f => f.id !== id))
            } else {
                const errData = await res.json()
                toast.error("Erro: " + (errData.error || "Erro ao excluir regra"))
            }
        } catch (error) {
            toast.error("Erro ao comunicar com o servidor")
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                        <GitBranch className="w-8 h-8 text-[#0084FF]" />
                        Regras
                    </h2>
                    <p className="text-zinc-400 mt-1">
                        Crie funis de engajamento interativos em formato de árvore para o Messenger.
                    </p>
                </div>
                <Link href="/workflows/create">
                    <Button className="bg-[#0084FF] hover:bg-[#0070D1] text-white gap-2">
                        <Plus className="w-4 h-4" />
                        Novo Flow
                    </Button>
                </Link>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[#0084FF]/5 border border-[#0084FF]/20">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-[#0084FF]/10">
                            <Zap className="w-4 h-4 text-[#0084FF]" />
                        </div>
                        <span className="font-semibold text-white text-sm">Gatilhos Personalizados</span>
                    </div>
                    <p className="text-xs text-zinc-400">Inicie fluxos baseados na interação do usuário.</p>
                </div>
                <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-green-500/10">
                            <Users className="w-4 h-4 text-green-500" />
                        </div>
                        <span className="font-semibold text-white text-sm">Botões Interativos</span>
                    </div>
                    <p className="text-xs text-zinc-400">Cada clique em botão avança o usuário para o próximo nó do fluxo automaticamente.</p>
                </div>
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-amber-500/10">
                            <Clock className="w-4 h-4 text-amber-500" />
                        </div>
                        <span className="font-semibold text-white text-sm">Automação Contínua</span>
                    </div>
                    <p className="text-xs text-zinc-400">Passe a responder contatos em tempo real com sequências visuais.</p>
                </div>
            </div>

            <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                    <CardTitle className="text-white">Suas Regras</CardTitle>
                    <CardDescription>Funis de engajamento ativos para o Messenger.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8 text-zinc-500">Carregando...</div>
                    ) : flows.length === 0 ? (
                        <div className="text-center py-16 border border-dashed border-zinc-800 rounded-lg">
                            <GitBranch className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-white mb-2">Nenhum flow criado</h3>
                            <p className="text-zinc-500 mb-6 max-w-sm mx-auto">
                                Crie sua primeira Regra para engajar seus contatos com uma sequência de mensagens interativas.
                            </p>
                            <Link href="/workflows/create">
                                <Button variant="outline" className="border-zinc-700 hover:bg-zinc-800 gap-2">
                                    <Plus className="w-4 h-4" />
                                    Criar Primeiro Flow
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {flows.map(flow => {
                                const handleNavigate = () => {
                                    if (!deletingId) router.push(`/workflows/${flow.id}`)
                                }

                                return (
                                    <div
                                        key={flow.id}
                                        className="flex items-center justify-between p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700 transition-colors cursor-pointer group"
                                        onClick={handleNavigate}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-[#0084FF]/10 flex items-center justify-center group-hover:bg-[#0084FF]/20 transition-colors">
                                                <GitBranch className="w-5 h-5 text-[#0084FF]" />
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-white">{flow.name}</h4>
                                                <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                                                    {flow.page && <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {flow.page.pageName}</span>}
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {format(new Date(flow.createdAt), "dd 'de' MMM, HH:mm", { locale: ptBR })}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge className={flow.isActive
                                                ? "bg-green-500/10 text-green-500 border-0"
                                                : "bg-zinc-500/10 text-zinc-500 border-0"
                                            }>
                                                {flow.isActive ? "Ativo" : "Pausado"}
                                            </Badge>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 sm:opacity-0 group-hover:opacity-100 transition-all z-10"
                                                onClick={(e) => handleDelete(e, flow.id)}
                                                disabled={deletingId === flow.id}
                                            >
                                                {deletingId === flow.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                                                ) : (
                                                    <Trash2 className="w-4 h-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
