"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Loader2, ArrowLeft, Send, Calendar, AlertCircle, CheckCircle2, ShieldAlert, ShieldCheck, RefreshCw, Sparkles, FileText, PenLine } from "lucide-react"
import { toast } from "sonner"

interface ComplianceAnalysis {
    status: 'APPROVED' | 'WARNING' | 'BLOCKED';
    score: number;
    issues: { type: string; keyword?: string; message: string; severity: string }[];
    suggestion: string | null;
    category: 'UTILITY' | 'MARKETING' | 'MIXED';
}

export default function CreateBroadcastPage() {
    const router = useRouter()
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
    const [buttons, setButtons] = useState<{ type: string, title: string, url: string }[]>([])

    const [sendMode, setSendMode] = useState("IMMEDIATE")
    const [scheduledAt, setScheduledAt] = useState("")

    // V2 State
    const [templateId, setTemplateId] = useState("")
    const [templates, setTemplates] = useState<any[]>([])

    // Message composition mode for UTILITY
    const [utilityMsgMode, setUtilityMsgMode] = useState<'template' | 'custom'>('template')
    const [customUtilityText, setCustomUtilityText] = useState("")

    // Compliance analysis state
    const [analysis, setAnalysis] = useState<ComplianceAnalysis | null>(null)
    const [analyzing, setAnalyzing] = useState(false)
    const analyzeTimeout = useRef<NodeJS.Timeout | null>(null)

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

    useEffect(() => {
        if (pageId && policyMode === 'UTILITY') {
            fetch(`/api/messenger/templates?pageId=${pageId}`)
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) setTemplates(data)
                })
                .catch(err => console.error(err))
        }
    }, [pageId, policyMode])

    // Debounced compliance analysis
    const analyzeText = useCallback((msgText: string) => {
        if (analyzeTimeout.current) clearTimeout(analyzeTimeout.current)

        if (!msgText || msgText.trim().length < 5) {
            setAnalysis(null)
            return
        }

        setAnalyzing(true)
        analyzeTimeout.current = setTimeout(async () => {
            try {
                const res = await fetch('/api/messenger/analyze-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: msgText, policyMode })
                })
                if (res.ok) {
                    const data = await res.json()
                    setAnalysis(data)
                }
            } catch (e) {
                console.error(e)
            } finally {
                setAnalyzing(false)
            }
        }, 800) // 800ms debounce
    }, [policyMode])

    // Trigger analysis when custom utility text changes
    useEffect(() => {
        if (utilityMsgMode === 'custom' && policyMode === 'UTILITY') {
            analyzeText(customUtilityText)
        }
    }, [customUtilityText, utilityMsgMode, policyMode, analyzeText])

    // Also analyze regular text in 24h mode
    useEffect(() => {
        if (policyMode !== 'UTILITY' && (messageType === 'TEXT' || messageType === 'BUTTON_TEMPLATE')) {
            analyzeText(text)
        }
    }, [text, policyMode, messageType, analyzeText])

    const applySuggestion = () => {
        if (analysis?.suggestion) {
            if (utilityMsgMode === 'custom') {
                setCustomUtilityText(analysis.suggestion)
            } else {
                setText(analysis.suggestion)
            }
            setAnalysis(null) // Reset so it re-analyzes
        }
    }

    const handleCreate = async () => {
        if (!name || !pageId) return toast.error("Preencha o nome e a página")

        if (policyMode !== 'UTILITY') {
            if ((messageType === 'TEXT' || messageType === 'BUTTON_TEMPLATE') && !text) return toast.error("Digite a mensagem")
            if (messageType === 'AUDIO' && !audioUrl) return toast.error("Insira a URL do áudio")
            if (messageType === 'BUTTON_TEMPLATE' && buttons.length === 0) return toast.error("Adicione pelo menos um botão")
        } else {
            if (utilityMsgMode === 'template' && !templateId) return toast.error("Selecione um template aprovado")
            if (utilityMsgMode === 'custom' && !customUtilityText) return toast.error("Digite a mensagem personalizada")
            if (utilityMsgMode === 'custom' && analysis?.status === 'BLOCKED') {
                return toast.error("Mensagem bloqueada pela política da Meta. Corrija os problemas ou use a sugestão de reescrita.")
            }
        }

        setLoading(true)
        try {
            let payload: any = {};
            let finalMessageType = messageType;

            if (policyMode === 'UTILITY') {
                if (utilityMsgMode === 'template') {
                    payload = { templateId };
                    finalMessageType = 'TEMPLATE';
                } else {
                    payload = { text: customUtilityText };
                    finalMessageType = 'TEXT';
                }
            } else {
                if (messageType === 'TEXT') payload = { text };
                else if (messageType === 'AUDIO') payload = { url: audioUrl };
                else if (messageType === 'BUTTON_TEMPLATE') payload = { text, buttons };
            }

            const res = await fetch('/api/broadcasts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    pageId,
                    audienceType,
                    sendMode,
                    scheduledAt: sendMode === 'SCHEDULED' ? scheduledAt : undefined,
                    policyMode,
                    tag: policyMode === 'TAGGED' ? tag : undefined,
                    messageType: finalMessageType,
                    payload,
                    templateId: policyMode === 'UTILITY' && utilityMsgMode === 'template' ? templateId : undefined
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

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-500'
        if (score >= 50) return 'text-yellow-500'
        return 'text-red-500'
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'APPROVED': return <ShieldCheck className="w-5 h-5 text-green-500" />
            case 'WARNING': return <ShieldAlert className="w-5 h-5 text-yellow-500" />
            case 'BLOCKED': return <AlertCircle className="w-5 h-5 text-red-500" />
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'APPROVED': return 'Aprovado'
            case 'WARNING': return 'Atenção'
            case 'BLOCKED': return 'Bloqueado'
        }
    }

    const getStatusBg = (status: string) => {
        switch (status) {
            case 'APPROVED': return 'bg-green-500/5 border-green-500/20'
            case 'WARNING': return 'bg-yellow-500/5 border-yellow-500/20'
            case 'BLOCKED': return 'bg-red-500/5 border-red-500/20'
        }
    }

    // Compliance Analysis Component
    const CompliancePanel = () => {
        if (!analysis) return null

        return (
            <div className={`p-4 rounded-lg border space-y-3 transition-all ${getStatusBg(analysis.status)}`}>
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {getStatusIcon(analysis.status)}
                        <span className="font-semibold text-sm text-white">
                            Análise de Compliance: {getStatusLabel(analysis.status)}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${getScoreColor(analysis.score)}`}>
                            {analysis.score}/100
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                            {analysis.category}
                        </Badge>
                    </div>
                </div>

                {/* Score Bar */}
                <div className="w-full bg-zinc-800 rounded-full h-2">
                    <div
                        className={`h-2 rounded-full transition-all duration-500 ${analysis.score >= 80 ? 'bg-green-500' : analysis.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                        style={{ width: `${analysis.score}%` }}
                    />
                </div>

                {/* Issues */}
                {analysis.issues.length > 0 && (
                    <div className="space-y-1">
                        <p className="text-xs text-zinc-500 font-medium">Problemas encontrados:</p>
                        {analysis.issues.map((issue, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs">
                                <span className={`mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full ${issue.severity === 'error' ? 'bg-red-500' : issue.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                                    }`} />
                                <span className="text-zinc-400">
                                    {issue.message}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Suggestion */}
                {analysis.suggestion && analysis.suggestion !== (utilityMsgMode === 'custom' ? customUtilityText : text) && (
                    <div className="space-y-2 pt-2 border-t border-zinc-700/50">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-[#0084FF]" />
                            <p className="text-xs font-semibold text-[#0084FF]">Sugestão de Reescrita (Meta-Compliant)</p>
                        </div>
                        <div className="p-3 bg-black/30 rounded text-xs text-zinc-300 font-mono leading-relaxed">
                            {analysis.suggestion}
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={applySuggestion}
                            className="w-full border-[#0084FF]/30 text-[#0084FF] hover:bg-[#0084FF]/10"
                        >
                            <RefreshCw className="w-3 h-3 mr-2" />
                            Aplicar Sugestão
                        </Button>
                    </div>
                )}

                {analysis.status === 'APPROVED' && analysis.issues.length === 0 && (
                    <div className="flex items-center gap-2 text-xs text-green-400">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Mensagem 100% compatível com as políticas da Meta!</span>
                    </div>
                )}
            </div>
        )
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
                                    placeholder="Ex: Lembrete de Agendamento"
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
                                <Select value={policyMode} onValueChange={(val) => {
                                    setPolicyMode(val);
                                    if (val === 'UTILITY') {
                                        setMessageType('TEMPLATE');
                                    } else {
                                        setMessageType('TEXT');
                                    }
                                    setAnalysis(null);
                                }}>
                                    <SelectTrigger className="bg-black/20 border-zinc-700">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="24H_ONLY">Janela 24h (Padrão e Seguro)</SelectItem>
                                        <SelectItem value="UTILITY">Utility (Fora de 24h - V2)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-zinc-500">
                                    {policyMode === '24H_ONLY'
                                        ? "Envia apenas para usuários que interagiram nas últimas 24h. Outros serão ignorados."
                                        : "Permite enviar fora de 24h usando Templates Aprovados ou mensagens transacionais verificadas."}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Step 3: Conteúdo */}
                    <Card className="bg-zinc-900/50 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white">3. Mensagem</CardTitle>
                            {policyMode === 'UTILITY' && (
                                <CardDescription className="text-zinc-400">
                                    Escolha um template aprovado ou escreva sua mensagem personalizada com análise de compliance em tempo real.
                                </CardDescription>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Message Type Selector */}
                            <div className="space-y-2">
                                <Label>Tipo de Mensagem</Label>
                                <div className="flex gap-2">
                                    {policyMode !== 'UTILITY' ? (
                                        <>
                                            <Button
                                                variant={messageType === 'TEXT' ? 'default' : 'outline'}
                                                onClick={() => setMessageType('TEXT')}
                                                className="flex-1"
                                            >
                                                Texto
                                            </Button>
                                            <Button
                                                variant={messageType === 'BUTTON_TEMPLATE' ? 'default' : 'outline'}
                                                onClick={() => setMessageType('BUTTON_TEMPLATE')}
                                                className="flex-1"
                                            >
                                                Texto + Botões
                                            </Button>
                                            <Button
                                                variant={messageType === 'AUDIO' ? 'default' : 'outline'}
                                                onClick={() => setMessageType('AUDIO')}
                                                className="flex-1"
                                            >
                                                Áudio
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button
                                                variant={utilityMsgMode === 'template' ? 'default' : 'outline'}
                                                onClick={() => { setUtilityMsgMode('template'); setAnalysis(null) }}
                                                className="flex-1"
                                            >
                                                <FileText className="w-4 h-4 mr-2" />
                                                Template Aprovado
                                            </Button>
                                            <Button
                                                variant={utilityMsgMode === 'custom' ? 'default' : 'outline'}
                                                onClick={() => { setUtilityMsgMode('custom'); setAnalysis(null) }}
                                                className="flex-1"
                                            >
                                                <PenLine className="w-4 h-4 mr-2" />
                                                Mensagem Personalizada
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* === 24H MODE: Text input === */}
                            {policyMode !== 'UTILITY' && messageType === 'TEXT' && (
                                <div className="space-y-3">
                                    <Label>Conteúdo do Texto</Label>
                                    <Textarea
                                        placeholder="Olá {{first_name}}, temos novidades..."
                                        className="bg-black/20 border-zinc-700 min-h-[120px]"
                                        value={text}
                                        onChange={e => setText(e.target.value)}
                                    />
                                    <div className="flex items-center justify-between text-xs text-zinc-500">
                                        <span>{text.length}/640 caracteres</span>
                                        {analyzing && <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Analisando...</span>}
                                    </div>
                                    <CompliancePanel />
                                </div>
                            )}

                            {/* === 24H MODE: Button Template === */}
                            {policyMode !== 'UTILITY' && messageType === 'BUTTON_TEMPLATE' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Texto da Mensagem</Label>
                                        <Textarea
                                            placeholder="Clique no botão abaixo..."
                                            className="bg-black/20 border-zinc-700"
                                            value={text}
                                            onChange={e => setText(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Botões (Máx 3)</Label>
                                        {buttons.map((btn, idx) => (
                                            <div key={idx} className="flex gap-2 items-center">
                                                <Input
                                                    placeholder="Título do Botão"
                                                    value={btn.title}
                                                    onChange={e => {
                                                        const newBtns = [...buttons];
                                                        newBtns[idx].title = e.target.value;
                                                        setButtons(newBtns);
                                                    }}
                                                    className="bg-black/20 border-zinc-700 flex-1"
                                                />
                                                <Input
                                                    placeholder="URL (https://...)"
                                                    value={btn.url}
                                                    onChange={e => {
                                                        const newBtns = [...buttons];
                                                        newBtns[idx].url = e.target.value;
                                                        setButtons(newBtns);
                                                    }}
                                                    className="bg-black/20 border-zinc-700 flex-1"
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        const newBtns = buttons.filter((_, i) => i !== idx);
                                                        setButtons(newBtns);
                                                    }}
                                                >
                                                    x
                                                </Button>
                                            </div>
                                        ))}
                                        {buttons.length < 3 && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setButtons([...buttons, { type: 'web_url', title: '', url: '' }])}
                                                className="w-full border-dashed"
                                            >
                                                + Adicionar Botão
                                            </Button>
                                        )}
                                    </div>
                                    <CompliancePanel />
                                </div>
                            )}

                            {/* === 24H MODE: Audio === */}
                            {policyMode !== 'UTILITY' && messageType === 'AUDIO' && (
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

                            {/* === UTILITY MODE: Template Selection === */}
                            {policyMode === 'UTILITY' && utilityMsgMode === 'template' && (
                                <div className="space-y-4">
                                    <Label>Selecione o Template</Label>
                                    <Select value={templateId} onValueChange={setTemplateId}>
                                        <SelectTrigger className="bg-black/20 border-zinc-700">
                                            <SelectValue placeholder="Escolha um template" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {templates.length > 0 ? templates.map((t: any) => (
                                                <SelectItem key={t.id} value={t.id}>
                                                    <div className="flex items-center gap-2">
                                                        <span>{t.name}</span>
                                                        {t.tag && (
                                                            <span className="text-[10px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded">
                                                                {t.tag}
                                                            </span>
                                                        )}
                                                    </div>
                                                </SelectItem>
                                            )) : <SelectItem value="none" disabled>Nenhum template encontrado para esta página</SelectItem>}
                                        </SelectContent>
                                    </Select>

                                    {/* Template Preview */}
                                    {templateId && templates.length > 0 && (() => {
                                        const selected = templates.find((t: any) => t.id === templateId);
                                        if (!selected) return null;
                                        return (
                                            <div className="p-4 rounded-lg bg-[#0084FF]/5 border border-[#0084FF]/20 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-white text-sm">{selected.name}</span>
                                                    <Badge variant="outline" className="text-[10px]">
                                                        {selected.category}
                                                    </Badge>
                                                    {selected.tag && (
                                                        <Badge variant="outline" className="text-[10px] border-yellow-500/50 text-yellow-500">
                                                            {selected.tag}
                                                        </Badge>
                                                    )}
                                                </div>
                                                {selected.description && (
                                                    <p className="text-xs text-zinc-400">{selected.description}</p>
                                                )}
                                                {selected.contentJson?.template && (
                                                    <div className="mt-2 p-3 bg-black/30 rounded text-xs text-zinc-300 font-mono">
                                                        {selected.contentJson.template}
                                                    </div>
                                                )}
                                                {selected.contentJson?.variables?.length > 0 && (
                                                    <div className="flex gap-1 flex-wrap mt-1">
                                                        <span className="text-[10px] text-zinc-500">Variáveis:</span>
                                                        {selected.contentJson.variables.map((v: string) => (
                                                            <span key={v} className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                                                                {`{{${v}}}`}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                            {/* === UTILITY MODE: Custom Message + Compliance === */}
                            {policyMode === 'UTILITY' && utilityMsgMode === 'custom' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Sua Mensagem Personalizada</Label>
                                        <Textarea
                                            placeholder="Olá {{first_name}}, informamos que seu agendamento para amanhã está confirmado..."
                                            className="bg-black/20 border-zinc-700 min-h-[140px]"
                                            value={customUtilityText}
                                            onChange={e => setCustomUtilityText(e.target.value)}
                                        />
                                        <div className="flex items-center justify-between text-xs text-zinc-500">
                                            <span>{customUtilityText.length}/640 caracteres</span>
                                            {analyzing && (
                                                <span className="flex items-center gap-1 text-[#0084FF]">
                                                    <Loader2 className="w-3 h-3 animate-spin" /> Analisando compliance...
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Variables Helper */}
                                    <div className="space-y-2">
                                        <Label className="text-xs text-zinc-500">Variáveis disponíveis (clique para inserir)</Label>
                                        <div className="flex gap-1.5 flex-wrap">
                                            {['{{first_name}}', '{{last_name}}', '{{order_id}}', '{{date}}', '{{time}}', '{{amount}}'].map(v => (
                                                <button
                                                    key={v}
                                                    type="button"
                                                    onClick={() => setCustomUtilityText(prev => prev + ' ' + v)}
                                                    className="text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white px-2 py-1 rounded transition-colors cursor-pointer"
                                                >
                                                    {v}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Compliance Panel */}
                                    <CompliancePanel />

                                    {/* Tips */}
                                    <div className="p-3 rounded-lg bg-[#0084FF]/5 border border-[#0084FF]/20">
                                        <div className="flex items-start gap-2">
                                            <Sparkles className="w-4 h-4 text-[#0084FF] mt-0.5 shrink-0" />
                                            <div className="text-xs text-zinc-400 space-y-1">
                                                <p className="font-semibold text-[#0084FF]">Dicas para mensagens Utility</p>
                                                <ul className="list-disc list-inside space-y-0.5">
                                                    <li>Use linguagem transacional: confirmações, lembretes, atualizações</li>
                                                    <li>Evite palavras promocionais: promoção, desconto, oferta, grátis</li>
                                                    <li>Inclua contexto do relacionamento: pedido, consulta, agendamento</li>
                                                    <li>Não use urgência artificial: última chance, só hoje, corra</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Meta Policy Warning (only in utility template mode) */}
                            {policyMode === 'UTILITY' && utilityMsgMode === 'template' && (
                                <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                                        <div className="text-xs text-yellow-500/80 space-y-1">
                                            <p className="font-semibold text-yellow-500">Política da Meta (Fev 2026)</p>
                                            <p>Message Tags foram deprecadas. Para enviar fora da janela de 24h, use templates Utility (transacionais) ou mensagens personalizadas analisadas.</p>
                                        </div>
                                    </div>
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
                                {policyMode === 'UTILITY' && (
                                    <div>
                                        <div className="text-xs text-zinc-500">Modo</div>
                                        <div className="text-white font-medium">
                                            {utilityMsgMode === 'template' ? 'Template' : 'Personalizada'}
                                        </div>
                                    </div>
                                )}
                                {analysis && (
                                    <div>
                                        <div className="text-xs text-zinc-500">Compliance</div>
                                        <div className="flex items-center gap-1.5">
                                            {getStatusIcon(analysis.status)}
                                            <span className={`text-sm font-medium ${getScoreColor(analysis.score)}`}>
                                                {analysis.score}/100
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <Button
                                    className="w-full bg-[#0084FF] hover:bg-[#0070D1] text-white mt-4"
                                    onClick={handleCreate}
                                    disabled={loading || (policyMode === 'UTILITY' && utilityMsgMode === 'custom' && analysis?.status === 'BLOCKED')}
                                >
                                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    {sendMode === 'IMMEDIATE' ? 'Enviar Agora' : 'Agendar Campanha'}
                                </Button>

                                {policyMode === 'UTILITY' && utilityMsgMode === 'custom' && analysis?.status === 'BLOCKED' && (
                                    <p className="text-xs text-red-400 text-center">
                                        Corrija os problemas de compliance ou aplique a sugestão antes de enviar.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}
