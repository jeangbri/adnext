"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, RefreshCw, Pause, Play, Trash, Send } from "lucide-react"

export default function BroadcastDetailPage({ params }: { params: { id: string } }) {
    const router = useRouter()
    const [campaign, setCampaign] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    // Poll for updates every 5s if active
    useEffect(() => {
        let interval: NodeJS.Timeout

        const fetchCampaign = async () => {
            try {
                const res = await fetch(`/api/broadcasts/${params.id}`)
                if (res.ok) {
                    const data = await res.json()
                    setCampaign(data)
                    // If running, keep polling
                    if (['SCHEDULED', 'SENDING'].includes(data.status)) {
                        // interval handled by useEffect re-run? No, setup interval inside
                    }
                } else {
                    router.push('/broadcast')
                }
            } catch (e) { console.error(e) }
            finally { setLoading(false) }
        }

        fetchCampaign()

        interval = setInterval(() => {
            if (campaign && ['SCHEDULED', 'SENDING'].includes(campaign.status)) {
                fetchCampaign()
            }
        }, 5000)

        return () => clearInterval(interval)
    }, [params.id, campaign?.status])

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

    const handleAction = async (status: string) => {
        // Pause/Resume
    }

    if (loading) return <div className="p-8 text-center text-zinc-500">Carregando...</div>
    if (!campaign) return null

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push('/broadcast')}>
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                    <h2 className="text-2xl font-bold text-white">{campaign.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{getStatusLabel(campaign.status)}</Badge>
                        <span className="text-sm text-zinc-500">{campaign.page.pageName}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-400">Total Público</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-white">{campaign.totalRecipients}</div></CardContent>
                </Card>
                <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-400">Enviados</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-green-500">{campaign.totalSent}</div></CardContent>
                </Card>
                <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-400">Falhas</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-red-500">{campaign.totalFailed}</div></CardContent>
                </Card>
                <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-400">Ignorados (Política)</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-yellow-500">{campaign.totalSkipped}</div></CardContent>
                </Card>
            </div>

            <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                    <CardTitle className="text-white">Detalhes do Envio</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-zinc-400">
                        {/* Placeholder for list of recipients if we want deep dive */}
                        <p>Os logs detalhados de cada envio estão disponíveis no banco de dados.</p>
                        <p className="mt-2"><b>Tipo de Mensagem:</b> {campaign.messageType}</p>
                        <p><b>Política:</b> {campaign.policyMode}</p>
                        {campaign.totalSkipped > 0 && (
                            <div className="mt-4 p-4 bg-yellow-500/10 text-yellow-500 rounded border border-yellow-500/20">
                                {campaign.totalSkipped} contatos foram ignorados porque estavam fora da janela de 24h e a campanha estava configurada como "Janela 24h (Seguro)".
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
