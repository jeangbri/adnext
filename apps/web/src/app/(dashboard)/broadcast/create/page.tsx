"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Loader2, ArrowLeft, Send, Calendar, AlertCircle } from "lucide-react"
import { toast } from "sonner"

export default function CreateBroadcastPage() {
    const router = useRouter()
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [accounts, setAccounts] = useState<any[]>([])

    // Form State
    const [name, setName] = useState("")
    const [pageId, setPageId] = useState("")
    const [audienceType, setAudienceType] = useState("ACTIVE_24H")
    const [policyMode, setPolicyMode] = useState("24H_ONLY")
    const [tag, setTag] = useState("ACCOUNT_UPDATE")
    const [messageType, setMessageType] = useState("TEXT")
    const [text, setText] = useState("")
    const [audioUrl, setAudioUrl] = useState("")
    const [sendMode, setSendMode] = useState("IMMEDIATE")
    const [scheduledAt, setScheduledAt] = useState("")

    useEffect(() => {
        const fetchPages = async () => {
            try {
                const res = await fetch('/api/messenger/status')
                if (res.ok) {
                    const data = await res.json()
                    setAccounts(data.accounts || [])
                }
            } catch (e) { console.error(e) }
        }
        fetchPages()
    }, [])

    const handleCreate = async () => {
        if (!name || !pageId) return toast.error("Preencha o nome e a página")
        if (messageType === 'TEXT' && !text) return toast.error("Digite a mensagem")
        if (messageType === 'AUDIO' && !audioUrl) return toast.error("Insira a URL do áudio")

        setLoading(true)
        try {
            const payload = messageType === 'TEXT' ? { text } : { url: audioUrl }

            const res = await fetch('/api/broadcasts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    pageId,
                    audienceType,
                    sendMode, // IMMEDIATE or SCHEDULED
                    scheduledAt: sendMode === 'SCHEDULED' ? scheduledAt : undefined,
                    policyMode,
                    tag: policyMode === 'TAGGED' ? tag : undefined,
                    messageType,
                    payload
                })
            })

            if (res.ok) {
                toast.success("Campanha criada com sucesso!")
                router.push('/broadcast')
            } else {
                const err = await res.json()
                toast.error(err.error || "Erro ao criar campanha")
            }
        } catch (e) {
            toast.error("Erro ao conectar com servidor")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                    <h2 className="text-2xl font-bold text-white">Nova Campanha</h2>
                    <p className="text-zinc-400">Configure seu envio em massa</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-6">
                    {/* Step 1: Configuração Básica */}
                    <Card className="bg-zinc-900/50 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white">1. Configurações</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Nome da Campanha</Label>
                                <Input
                                    placeholder="Ex: Promoção Dia das Mães"
                                    className="bg-black/20 border-zinc-700"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Página do Facebook</Label>
                                <Select value={pageId} onValueChange={setPageId}>
                                    <SelectTrigger className="bg-black/20 border-zinc-700">
                                        <SelectValue placeholder="Selecione a página" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {accounts?.length > 0 ? accounts.map(acc => (
                                            <SelectItem key={acc.uniqueId || acc.pageId} value={acc.pageId}>{acc.pageName}</SelectItem>
                                        )) : <SelectItem value="loading" disabled>Carregando...</SelectItem>}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Step 2: Público e Política */}
                    <Card className="bg-zinc-900/50 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white">2. Público Alvo</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div
                                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${audienceType === 'ACTIVE_24H' ? 'bg-[#0084FF]/10 border-[#0084FF] text-white' : 'bg-black/20 border-zinc-700 text-zinc-400'}`}
                                    onClick={() => setAudienceType('ACTIVE_24H')}
                                >
                                    <div className="font-bold mb-1">Ativos (24h)</div>
                                    <div className="text-xs opacity-80">Interagiram nas últimas 24 horas</div>
                                </div>
                                <div
                                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${audienceType === 'ALL' ? 'bg-[#0084FF]/10 border-[#0084FF] text-white' : 'bg-black/20 border-zinc-700 text-zinc-400'}`}
                                    onClick={() => setAudienceType('ALL')}
                                >
                                    <div className="font-bold mb-1">Todos os Contatos</div>
                                    <div className="text-xs opacity-80">Base completa (Cuidado 24h)</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Política de Envio (Meta)</Label>
                                <Select value={policyMode} onValueChange={setPolicyMode}>
                                    <SelectTrigger className="bg-black/20 border-zinc-700">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="24H_ONLY">Janela 24h (Padrão e Seguro)</SelectItem>
                                        <SelectItem value="TAGGED">Message Tags (Fora de 24h)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-zinc-500">
                                    {policyMode === '24H_ONLY'
                                        ? "Envia apenas para usuários que interagiram nas últimas 24h. Outros serão ignorados."
                                        : "Permite enviar fora de 24h usando Tags. Use com cuidado para não ser bloqueado."}
                                </p>
                            </div>

                            {policyMode === 'TAGGED' && (
                                <div className="space-y-2 p-4 bg-yellow-500/10 rounded-md border border-yellow-500/20">
                                    <Label className="text-yellow-500">Selecione a Tag</Label>
                                    <Select value={tag} onValueChange={setTag}>
                                        <SelectTrigger className="bg-black/20 border-zinc-700">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ACCOUNT_UPDATE">CONFIRMED_EVENT_UPDATE (Lembretes de evento)</SelectItem>
                                            <SelectItem value="POST_PURCHASE_UPDATE">POST_PURCHASE_UPDATE (Atualização de pedido)</SelectItem>
                                            <SelectItem value="ACCOUNT_UPDATE">ACCOUNT_UPDATE (Atualização de conta)</SelectItem>
                                            <SelectItem value="HUMAN_AGENT">HUMAN_AGENT (Resposta humana)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Step 3: Conteúdo */}
                    <Card className="bg-zinc-900/50 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white">3. Mensagem</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Tipo de Mensagem</Label>
                                <div className="flex gap-2">
                                    <Button
                                        variant={messageType === 'TEXT' ? 'default' : 'outline'}
                                        onClick={() => setMessageType('TEXT')}
                                        className="flex-1"
                                    >
                                        Texto
                                    </Button>
                                    <Button
                                        variant={messageType === 'AUDIO' ? 'default' : 'outline'}
                                        onClick={() => setMessageType('AUDIO')}
                                        className="flex-1"
                                    >
                                        Áudio
                                    </Button>
                                </div>
                            </div>

                            {messageType === 'TEXT' && (
                                <div className="space-y-2">
                                    <Label>Conteúdo do Texto</Label>
                                    <Textarea
                                        placeholder="Olá {{first_name}}, temos novidades..."
                                        className="bg-black/20 border-zinc-700 min-h-[100px]"
                                        value={text}
                                        onChange={e => setText(e.target.value)}
                                    />
                                </div>
                            )}

                            {messageType === 'AUDIO' && (
                                <div className="space-y-2">
                                    <Label>URL do Áudio (MP3/OGG)</Label>
                                    <Input
                                        placeholder="https://exemplo.com/audio.mp3"
                                        className="bg-black/20 border-zinc-700"
                                        value={audioUrl}
                                        onChange={e => setAudioUrl(e.target.value)}
                                    />
                                    <p className="text-xs text-zinc-500">O arquivo deve ser público e acessível pela Meta.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Step 4: Envio */}
                    <Card className="bg-zinc-900/50 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white">4. Agendamento</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Quando enviar?</Label>
                                <Select value={sendMode} onValueChange={setSendMode}>
                                    <SelectTrigger className="bg-black/20 border-zinc-700">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="IMMEDIATE">Enviar Imediatamente</SelectItem>
                                        <SelectItem value="SCHEDULED">Agendar</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {sendMode === 'SCHEDULED' && (
                                <div className="space-y-2">
                                    <Label>Data e Hora</Label>
                                    <Input
                                        type="datetime-local"
                                        className="bg-black/20 border-zinc-700"
                                        value={scheduledAt}
                                        onChange={e => setScheduledAt(e.target.value)}
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="md:col-span-1">
                    <div className="sticky top-6 space-y-4">
                        <Card className="bg-zinc-900 border-zinc-800">
                            <CardHeader>
                                <CardTitle className="text-sm text-zinc-400 uppercase tracking-wider">Resumo</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <div className="text-xs text-zinc-500">Página</div>
                                    <div className="text-white font-medium">{accounts.find(a => a.pageId === pageId)?.pageName || '-'}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-zinc-500">Público</div>
                                    <Badge variant="outline">{audienceType}</Badge>
                                </div>
                                <div>
                                    <div className="text-xs text-zinc-500">Política</div>
                                    <div className="text-white font-medium">{policyMode}</div>
                                </div>

                                <Button
                                    className="w-full bg-[#0084FF] hover:bg-[#0070D1] text-white mt-4"
                                    onClick={handleCreate}
                                    disabled={loading}
                                >
                                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    {sendMode === 'IMMEDIATE' ? 'Enviar Agora' : 'Agendar Campanha'}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}
