"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Users, Send, Clock, AlertTriangle } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

export default function BroadcastListPage() {
    const router = useRouter()
    const [campaigns, setCampaigns] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchCampaigns = async () => {
            try {
                const res = await fetch('/api/broadcasts')
                if (res.ok) {
                    const data = await res.json()
                    setCampaigns(data)
                }
            } catch (e) { console.error(e) }
            finally { setLoading(false) }
        }
        fetchCampaigns()
    }, [])

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'COMPLETED': return 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
            case 'SENDING': return 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20'
            case 'SCHEDULED': return 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20'
            case 'FAILED': return 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
            default: return 'bg-zinc-500/10 text-zinc-500 hover:bg-zinc-500/20'
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'COMPLETED': return 'Concluído'
            case 'SENDING': return 'Em Envio'
            case 'SCHEDULED': return 'Agendado'
            case 'FAILED': return 'Falha'
            case 'DRAFT': return 'Rascunho'
            default: return status
        }
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white">Broadcast</h2>
                    <p className="text-zinc-400">Envie mensagens em massa para seus contatos do Messenger.</p>
                </div>
                <Button onClick={() => router.push('/broadcast/create')} className="bg-[#0084FF] hover:bg-[#0070D1] text-white">
                    <Plus className="mr-2 h-4 w-4" /> Nova Campanha
                </Button>
            </div>

            <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                    <CardTitle className="text-white">Campanhas Recentes</CardTitle>
                    <CardDescription>Gerencie seus envios em massa.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8 text-zinc-500">Carregando...</div>
                    ) : campaigns.length === 0 ? (
                        <div className="text-center py-16 border border-dashed border-zinc-800 rounded-lg">
                            <Send className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-white mb-2">Nenhuma campanha encontrada</h3>
                            <p className="text-zinc-500 mb-6">Crie sua primeira campanha para engajar seus leads.</p>
                            <Button onClick={() => router.push('/broadcast/create')} variant="outline" className="border-zinc-700 hover:bg-zinc-800">
                                Criar Campanha
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {campaigns.map(campaign => (
                                <div
                                    key={campaign.id}
                                    className="flex items-center justify-between p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700 transition-colors cursor-pointer"
                                    onClick={() => router.push(`/broadcast/${campaign.id}`)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-[#0084FF]/10 flex items-center justify-center">
                                            <Send className="w-5 h-5 text-[#0084FF]" />
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-white">{campaign.name}</h4>
                                            <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                                                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {campaign.page.pageName}</span>
                                                <span>•</span>
                                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {format(new Date(campaign.createdAt), "dd 'de' MMM, HH:mm", { locale: ptBR })}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="hidden md:block text-right">
                                            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Progresso</div>
                                            <div className="text-sm font-medium text-white">
                                                {campaign.totalSent} / {campaign.totalRecipients > 0 ? campaign.totalRecipients : '-'}
                                            </div>
                                        </div>
                                        <Badge className={`${getStatusColor(campaign.status)} border-0`}>
                                            {getStatusLabel(campaign.status)}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
