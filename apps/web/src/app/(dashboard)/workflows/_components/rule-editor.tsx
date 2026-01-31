"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
    Plus, Trash2, Save, ArrowLeft, Image as ImageIcon,
    MessageSquare, Music, MousePointerClick, GripVertical,
    Loader2, Upload, FileAudio, Link as LinkIcon
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface RuleEditorProps {
    rule?: any
    mode: 'create' | 'edit'
}

type ButtonType = 'web_url' | 'postback'

interface ActionButton {
    type: ButtonType
    title: string
    url?: string
    payload?: string
}

export function RuleEditor({ rule, mode }: RuleEditorProps) {
    const router = useRouter()
    const supabase = createClient()
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState<Record<string, boolean>>({})

    // Form State
    const [name, setName] = useState(rule?.name || '')
    const [isActive, setIsActive] = useState(rule?.isActive ?? true)
    const [priority, setPriority] = useState(rule?.priority || 0)
    const [cooldown, setCooldown] = useState(rule?.cooldownSeconds || 0)

    // Match State
    const [matchType, setMatchType] = useState(rule?.matchType || 'CONTAINS')
    const [matchOperator, setMatchOperator] = useState(rule?.matchOperator || 'ANY')
    const [keywordInput, setKeywordInput] = useState('')
    const [keywords, setKeywords] = useState<string[]>(rule?.keywords || [])

    // Page Selection State
    const [accounts, setAccounts] = useState<any[]>([])
    const [selectedPageIds, setSelectedPageIds] = useState<string[]>(rule?.pageIds || [])

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

    // Actions State
    const [actions, setActions] = useState<any[]>(rule?.actions || [])

    const addKeyword = () => {
        if (keywordInput.trim()) {
            setKeywords([...keywords, keywordInput.trim()])
            setKeywordInput('')
        }
    }

    const removeKeyword = (idx: number) => {
        setKeywords(keywords.filter((_, i) => i !== idx))
    }

    const addAction = (type: string) => {
        const newAction = {
            type,
            delayMs: 0,
            payload: getInitialPayload(type)
        }
        setActions([...actions, newAction])
        toast.success(`Ação ${getActionLabel(type)} adicionada`)
    }

    const getInitialPayload = (type: string) => {
        switch (type) {
            case 'TEXT': return { text: '' }
            case 'BUTTON_TEMPLATE': return { text: '', buttons: [] }
            case 'GENERIC_TEMPLATE': return { title: '', subtitle: '', imageUrl: '', buttons: [] }
            case 'AUDIO': return { url: '' }
            case 'IMAGE': return { url: '' }
            default: return {}
        }
    }

    const getActionLabel = (type: string) => {
        switch (type) {
            case 'TEXT': return 'Texto'
            case 'BUTTON_TEMPLATE': return 'Botões'
            case 'GENERIC_TEMPLATE': return 'Card (Img + Texto)'
            case 'AUDIO': return 'Áudio'
            case 'IMAGE': return 'Imagem'
            default: return type
        }
    }

    const removeAction = (idx: number) => {
        setActions(actions.filter((_, i) => i !== idx))
    }

    const updateAction = (idx: number, field: string, value: any) => {
        const newActions = [...actions]
        if (field.startsWith('payload.')) {
            const key = field.split('.')[1]
            newActions[idx].payload = { ...newActions[idx].payload, [key]: value }
        } else {
            newActions[idx][field] = value
        }
        setActions(newActions)
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, actionIdx: number, field: string = 'url') => {
        const file = e.target.files?.[0]
        if (!file) return

        // Basic validation
        if (file.size > 20 * 1024 * 1024) { // 20MB limit
            toast.error('Arquivo muito grande (Máx 20MB)')
            return
        }

        setUploading({ ...uploading, [actionIdx]: true })

        try {
            const formData = new FormData()
            formData.append('file', file)

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Erro no upload')
            }

            const publicUrl = data.url
            console.log('Upload success, public URL:', publicUrl)

            updateAction(actionIdx, `payload.${field}`, publicUrl)
            toast.success('Arquivo enviado com sucesso!')
        } catch (error: any) {
            console.error('Upload catch error:', error)
            toast.error('Erro no upload: ' + (error.message || 'Erro desconhecido'))
        } finally {
            setUploading({ ...uploading, [actionIdx]: false })
            e.target.value = ''
        }
    }

    // Button Editor Helper Functions
    const addButtonToPayload = (actionIdx: number) => {
        const action = actions[actionIdx]
        const currentButtons = action.payload.buttons || []
        if (currentButtons.length >= 3) {
            toast.error('Máximo de 3 botões permitidos')
            return
        }
        const newButtons = [...currentButtons, { type: 'web_url', title: 'Novo Botão', url: '' }]
        updateAction(actionIdx, 'payload.buttons', newButtons)
    }

    const updateButton = (actionIdx: number, btnIdx: number, field: keyof ActionButton, value: string) => {
        const action = actions[actionIdx]
        const newButtons = [...(action.payload.buttons || [])]
        newButtons[btnIdx] = { ...newButtons[btnIdx], [field]: value }
        updateAction(actionIdx, 'payload.buttons', newButtons)
    }

    const removeButton = (actionIdx: number, btnIdx: number) => {
        const action = actions[actionIdx]
        const newButtons = (action.payload.buttons || []).filter((_: any, i: number) => i !== btnIdx)
        updateAction(actionIdx, 'payload.buttons', newButtons)
    }

    const handleSave = async () => {
        if (!name.trim()) {
            toast.error('Nome da regra é obrigatório')
            return
        }
        setLoading(true)
        const payload = {
            name,
            isActive,
            priority: Number(priority),
            cooldownSeconds: Number(cooldown),
            matchType,
            matchOperator,
            keywords,
            pageIds: selectedPageIds,
            actions
        }

        try {
            const url = mode === 'create' ? '/api/automations' : `/api/automations/${rule.id}`
            const method = mode === 'create' ? 'POST' : 'PUT'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (!res.ok) throw new Error('Failed to save')

            toast.success('Regra salva com sucesso!')
            router.push('/workflows')
            router.refresh()
        } catch (e) {
            console.error(e)
            toast.error('Erro ao salvar regra')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto pb-32">
            {/* Header */}
            <div className="flex items-center justify-between sticky top-0 z-50 bg-background/80 backdrop-blur-lg py-4 border-b border-white/5 -mx-4 px-4 lg:-mx-8 lg:px-8">
                <div className="flex items-center gap-4">
                    <Link href="/workflows">
                        <Button variant="ghost" size="icon" className="hover:bg-zinc-800 rounded-full">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            {mode === 'create' ? 'Criar Nova Regra' : 'Editar Regra'}
                        </h1>
                        <p className="text-xs text-zinc-400">Configure os gatilhos e respostas automáticas</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 rounded-full border border-zinc-800">
                        <Switch id="active-mode" checked={isActive} onCheckedChange={setIsActive} />
                        <Label htmlFor="active-mode" className="text-xs text-zinc-400 cursor-pointer">{isActive ? 'Ativo' : 'Pausado'}</Label>
                    </div>
                    <Button onClick={handleSave} disabled={loading} className="bg-[#0084FF] hover:bg-[#0070D1] text-white rounded-full px-6 shadow-lg shadow-blue-500/20">
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Salvar Regra
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Triggers */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="bg-zinc-900/40 border-zinc-800/60 shadow-xl overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500 opacity-20" />
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-zinc-200">Gatilho (Quando responder?)</CardTitle>
                            <CardDescription>Defina quando esta automação será disparada.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="space-y-4 pb-4 border-b border-white/5">
                                <Label className="text-xs uppercase tracking-wider text-zinc-500">Páginas (Onde Executar)</Label>
                                {loading && accounts.length === 0 ? (
                                    <div className="text-xs text-zinc-500 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Carregando páginas...</div>
                                ) : accounts.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {accounts.map(account => (
                                            <div
                                                key={account.id}
                                                onClick={() => {
                                                    if (selectedPageIds.includes(account.pageId)) {
                                                        setSelectedPageIds(selectedPageIds.filter(id => id !== account.pageId))
                                                    } else {
                                                        setSelectedPageIds([...selectedPageIds, account.pageId])
                                                    }
                                                }}
                                                className={`
                                                    cursor-pointer rounded-lg border p-3 flex items-center gap-3 transition-all
                                                    ${selectedPageIds.includes(account.pageId)
                                                        ? 'bg-blue-500/10 border-blue-500/50 hover:bg-blue-500/20'
                                                        : 'bg-black/20 border-zinc-800 hover:border-zinc-700'
                                                    }
                                                `}
                                            >
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${selectedPageIds.includes(account.pageId) ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                                                    {account.pageName.charAt(0)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium truncate ${selectedPageIds.includes(account.pageId) ? 'text-blue-100' : 'text-zinc-300'}`}>
                                                        {account.pageName}
                                                    </p>
                                                    <p className="text-[10px] text-zinc-500 truncate">ID: {account.pageId}</p>
                                                </div>
                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedPageIds.includes(account.pageId) ? 'bg-blue-500 border-blue-500' : 'border-zinc-600'}`}>
                                                    {selectedPageIds.includes(account.pageId) && <div className="w-2 h-2 rounded-full bg-white" />}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-xs text-yellow-500/80 bg-yellow-500/10 p-3 rounded border border-yellow-500/20">
                                        Nenhuma página conectada. Vá em Configurações &gt; Integrações.
                                    </div>
                                )}
                                <p className="text-[10px] text-zinc-500">Se nenhuma for selecionada, a regra será aplicada a <strong>TODAS</strong> as páginas.</p>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wider text-zinc-500">Nome Identificador</Label>
                                <Input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Ex: Resposta Preços"
                                    className="bg-black/40 border-zinc-800 focus:border-primary/50"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wider text-zinc-500">Palavras-chave</Label>
                                <div className="space-y-3">
                                    <div className="flex gap-2">
                                        <Select value={matchType} onValueChange={setMatchType}>
                                            <SelectTrigger className="w-[130px] bg-black/40 border-zinc-800 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="CONTAINS">Contém</SelectItem>
                                                <SelectItem value="EXACT">Exato</SelectItem>
                                                <SelectItem value="STARTS_WITH">Começa com</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Input
                                            value={keywordInput}
                                            onChange={e => setKeywordInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && addKeyword()}
                                            placeholder="Digite e enter..."
                                            className="flex-1 bg-black/40 border-zinc-800 text-sm"
                                        />
                                    </div>
                                    <div className="flex flex-wrap gap-2 min-h-[40px] p-2 bg-black/20 rounded-md border border-zinc-800/50">
                                        {keywords.length === 0 && <span className="text-xs text-zinc-600 block w-full text-center py-2">Nenhuma palavra-chave</span>}
                                        {keywords.map((k, i) => (
                                            <Badge key={i} variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20 gap-1 pl-2 pr-1 py-0.5">
                                                {k}
                                                <Trash2 className="w-3 h-3 cursor-pointer hover:text-red-400" onClick={() => removeKeyword(i)} />
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div className="space-y-2">
                                    <Label className="text-xs text-zinc-500">Prioridade</Label>
                                    <Input type="number" value={priority} onChange={e => setPriority(Number(e.target.value))} className="bg-black/40 border-zinc-800" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-zinc-500">Cooldown (s)</Label>
                                    <Input type="number" value={cooldown} onChange={e => setCooldown(Number(e.target.value))} className="bg-black/40 border-zinc-800" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="p-4 rounded-xl border border-dashed border-zinc-800/50 bg-zinc-900/20 text-center">
                        <p className="text-xs text-zinc-500">Dica: Use prioridade mais alta para regras específicas que devem sobrepor regras genéricas.</p>
                    </div>
                </div>

                {/* Right Column: Actions */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-medium text-white flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-primary" />
                            Fluxo de Resposta
                            <Badge className="bg-zinc-800 text-zinc-400 hover:bg-zinc-800">{actions.length}</Badge>
                        </h2>

                        <div className="flex gap-2">
                            {/* Mini Toolbar for quick add */}
                        </div>
                    </div>

                    <div className="space-y-4 min-h-[200px]">
                        {actions.length === 0 && (
                            <div className="h-64 rounded-xl border border-dashed border-zinc-800 flex flex-col items-center justify-center text-zinc-500 gap-4 bg-zinc-900/20">
                                <MessageSquare className="w-10 h-10 opacity-20" />
                                <p>Nenhuma ação definida.</p>
                                <p className="text-sm">Selecione uma ação abaixo para começar.</p>
                            </div>
                        )}

                        {actions.map((action, idx) => (
                            <div key={idx} className="group relative pl-4 border-l-2 border-zinc-800 hover:border-primary/50 transition-colors">
                                {/* Action Connector Line */}
                                <div className="absolute -left-[5px] top-6 w-2 h-2 rounded-full bg-zinc-800 group-hover:bg-primary transition-colors ring-4 ring-background" />

                                <Card className="bg-zinc-950/50 border-zinc-800/80 group-hover:border-zinc-700 transition-colors">
                                    <CardHeader className="py-3 px-4 bg-white/5 border-b border-white/5 flex flex-row items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="bg-black/40 border-zinc-700 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                                                {getActionLabel(action.type)}
                                            </Badge>
                                            <span className="text-xs text-zinc-500">Ação #{idx + 1}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/20 border border-zinc-800/50 mx-2">
                                                <span className="text-[10px] text-zinc-500">Atraso:</span>
                                                <Input
                                                    className="w-12 h-5 text-[10px] px-1 py-0 bg-transparent border-none focus-visible:ring-0 text-right"
                                                    value={action.delayMs}
                                                    onChange={e => updateAction(idx, 'delayMs', Number(e.target.value))}
                                                />
                                                <span className="text-[10px] text-zinc-500">ms</span>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md" onClick={() => removeAction(idx)}>
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-4">
                                        {/* TEXT EDITOR */}
                                        {action.type === 'TEXT' && (
                                            <div className="space-y-2">
                                                <Label className="text-xs text-zinc-400">Mensagem de texto</Label>
                                                <textarea
                                                    className="flex w-full rounded-md border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary min-h-[80px]"
                                                    value={action.payload.text || ''}
                                                    onChange={e => updateAction(idx, 'payload.text', e.target.value)}
                                                    placeholder="Olá! Como posso ajudar?"
                                                />
                                            </div>
                                        )}

                                        {/* AUDIO EDITOR */}
                                        {action.type === 'AUDIO' && (
                                            <div className="space-y-4">
                                                <Label className="text-xs text-zinc-400">Arquivo de Áudio</Label>
                                                <div className="flex flex-col gap-3">
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            disabled
                                                            value={action.payload.url || ''}
                                                            placeholder="URL do aúdio..."
                                                            className="bg-black/40 border-zinc-800 opacity-70"
                                                        />
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <label className="flex-1 cursor-pointer">
                                                            <div className="flex items-center justify-center gap-2 w-full h-10 rounded-md border border-dashed border-zinc-700 hover:border-primary/50 hover:bg-primary/5 transition-all text-sm text-zinc-400 hover:text-primary">
                                                                {uploading[idx] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                                                {uploading[idx] ? 'Enviando...' : 'Carregar do Dispositivo (MP3, OGG, WAV)'}
                                                            </div>
                                                            <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileUpload(e, idx)} />
                                                        </label>
                                                    </div>

                                                    {action.payload.url && (
                                                        <audio controls src={action.payload.url} className="w-full mt-2 h-8" />
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* IMAGE EDITOR */}
                                        {action.type === 'IMAGE' && (
                                            <div className="space-y-4">
                                                <Label className="text-xs text-zinc-400">Imagem Avulsa</Label>
                                                <div className="flex flex-col gap-3">
                                                    <label className="flex-1 cursor-pointer">
                                                        <div className="relative group overflow-hidden rounded-lg border-2 border-dashed border-zinc-700 hover:border-primary/50 transition-all bg-black/20 aspect-video flex flex-col items-center justify-center">
                                                            {action.payload.url ? (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img src={action.payload.url} alt="Preview" className="w-full h-full object-contain" />
                                                            ) : (
                                                                <>
                                                                    {uploading[idx] ? <Loader2 className="w-8 h-8 animate-spin text-zinc-500" /> : <ImageIcon className="w-8 h-8 text-zinc-500 mb-2 group-hover:text-primary" />}
                                                                    <span className="text-sm text-zinc-400 group-hover:text-primary">Clique para enviar imagem</span>
                                                                </>
                                                            )}
                                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, idx)} />
                                                        </div>
                                                    </label>
                                                </div>
                                            </div>
                                        )}

                                        {/* BUTTONS TEMPLATE EDITOR */}
                                        {action.type === 'BUTTON_TEMPLATE' && (
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label className="text-xs text-zinc-400">Texto de Apoio</Label>
                                                    <Input
                                                        className="bg-black/40 border-zinc-800"
                                                        value={action.payload.text || ''}
                                                        onChange={e => updateAction(idx, 'payload.text', e.target.value)}
                                                        placeholder="Escolha uma opção abaixo:"
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-xs text-zinc-400">Botões (Max 3)</Label>
                                                        <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => addButtonToPayload(idx)} disabled={(action.payload.buttons?.length || 0) >= 3}>
                                                            <Plus className="w-3 h-3 mr-1" /> Add
                                                        </Button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {(action.payload.buttons || []).map((btn: any, btnIndex: number) => (
                                                            <div key={btnIndex} className="grid grid-cols-12 gap-2 bg-black/20 p-2 rounded border border-zinc-800 items-start">
                                                                <div className="col-span-3">
                                                                    <Select value={btn.type} onValueChange={v => updateButton(idx, btnIndex, 'type', v)}>
                                                                        <SelectTrigger className="h-8 text-xs bg-black/40 border-zinc-700"><SelectValue /></SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="web_url">Link</SelectItem>
                                                                            <SelectItem value="postback">Postback</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                                <div className="col-span-4">
                                                                    <Input
                                                                        className="h-8 text-xs bg-black/40 border-zinc-700"
                                                                        placeholder="Título"
                                                                        value={btn.title}
                                                                        onChange={e => updateButton(idx, btnIndex, 'title', e.target.value)}
                                                                    />
                                                                </div>
                                                                <div className="col-span-4">
                                                                    <Input
                                                                        className="h-8 text-xs bg-black/40 border-zinc-700"
                                                                        placeholder={btn.type === 'web_url' ? 'https://...' : 'Payload ID'}
                                                                        value={btn.type === 'web_url' ? btn.url : btn.payload}
                                                                        onChange={e => updateButton(idx, btnIndex, btn.type === 'web_url' ? 'url' : 'payload', e.target.value)}
                                                                    />
                                                                </div>
                                                                <div className="col-span-1 flex justify-end">
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-red-400" onClick={() => removeButton(idx, btnIndex)}>
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {(action.payload.buttons?.length || 0) === 0 && (
                                                            <div className="text-center py-4 text-xs text-zinc-600 border border-dashed border-zinc-800 rounded">
                                                                Adicione botões clicando no + acima
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* GENERIC TEMPLATE (CARD WITH IMAGE) EDITOR */}
                                        {action.type === 'GENERIC_TEMPLATE' && (
                                            <div className="flex flex-col md:flex-row gap-4">
                                                {/* Image Upload Area */}
                                                <div className="w-full md:w-1/3 shrink-0">
                                                    <label className="cursor-pointer block h-full">
                                                        <div className="h-full min-h-[140px] rounded-lg border-2 border-dashed border-zinc-700 hover:border-primary/50 transition-all bg-black/20 flex flex-col items-center justify-center overflow-hidden relative">
                                                            {action.payload.imageUrl ? (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img src={action.payload.imageUrl} alt="Card Cover" className="absolute inset-0 w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="text-center p-4">
                                                                    {uploading[idx] ? <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-zinc-500" /> : <ImageIcon className="w-6 h-6 mx-auto mb-2 text-zinc-500" />}
                                                                    <span className="text-[10px] text-zinc-400 block">Capa do Card</span>
                                                                </div>
                                                            )}
                                                            <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <Upload className="w-6 h-6 text-white" />
                                                            </div>
                                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, idx, 'imageUrl')} />
                                                        </div>
                                                    </label>
                                                </div>

                                                <div className="flex-1 space-y-3">
                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-zinc-400">Título</Label>
                                                        <Input
                                                            className="h-8 bg-black/40 border-zinc-800"
                                                            value={action.payload.title || ''}
                                                            onChange={e => updateAction(idx, 'payload.title', e.target.value)}
                                                            placeholder="Título do Produto/Card"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-zinc-400">Subtítulo</Label>
                                                        <Input
                                                            className="h-8 bg-black/40 border-zinc-800"
                                                            value={action.payload.subtitle || ''}
                                                            onChange={e => updateAction(idx, 'payload.subtitle', e.target.value)}
                                                            placeholder="Breve descrição..."
                                                        />
                                                    </div>

                                                    <div className="space-y-2 pt-2">
                                                        <div className="flex items-center justify-between">
                                                            <Label className="text-xs text-zinc-400">Botões (Max 3)</Label>
                                                            <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => addButtonToPayload(idx)} disabled={(action.payload.buttons?.length || 0) >= 3}>
                                                                <Plus className="w-3 h-3 mr-1" /> Add
                                                            </Button>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {(action.payload.buttons || []).map((btn: any, btnIndex: number) => (
                                                                <div key={btnIndex} className="grid grid-cols-12 gap-2 bg-black/20 p-2 rounded border border-zinc-800 items-center">
                                                                    <div className="col-span-3">
                                                                        <Select value={btn.type} onValueChange={v => updateButton(idx, btnIndex, 'type', v)}>
                                                                            <SelectTrigger className="h-7 text-[10px] bg-black/40 border-zinc-700"><SelectValue /></SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="web_url">Link</SelectItem>
                                                                                <SelectItem value="postback">Postback</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    <div className="col-span-4">
                                                                        <Input
                                                                            className="h-7 text-[10px] bg-black/40 border-zinc-700"
                                                                            placeholder="Título"
                                                                            value={btn.title}
                                                                            onChange={e => updateButton(idx, btnIndex, 'title', e.target.value)}
                                                                        />
                                                                    </div>
                                                                    <div className="col-span-4">
                                                                        <Input
                                                                            className="h-7 text-[10px] bg-black/40 border-zinc-700"
                                                                            placeholder={btn.type === 'web_url' ? 'URL' : 'Payload'}
                                                                            value={btn.type === 'web_url' ? btn.url : btn.payload}
                                                                            onChange={e => updateButton(idx, btnIndex, btn.type === 'web_url' ? 'url' : 'payload', e.target.value)}
                                                                        />
                                                                    </div>
                                                                    <div className="col-span-1 flex justify-end">
                                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-red-400" onClick={() => removeButton(idx, btnIndex)}>
                                                                            <Trash2 className="w-3 h-3" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                    </CardContent>
                                </Card>
                            </div>
                        ))}
                    </div>

                    {/* Add Action Bar (Bottom Sticky or just Block) */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-4 border-t border-zinc-800">
                        <Button variant="outline" className="h-auto py-3 flex flex-col gap-2 hover:bg-zinc-800 border-zinc-800" onClick={() => addAction('TEXT')}>
                            <MessageSquare className="w-5 h-5 text-zinc-400 group-hover:text-primary" />
                            <span className="text-xs">Texto</span>
                        </Button>
                        <Button variant="outline" className="h-auto py-3 flex flex-col gap-2 hover:bg-zinc-800 border-zinc-800" onClick={() => addAction('BUTTON_TEMPLATE')}>
                            <MousePointerClick className="w-5 h-5 text-zinc-400 group-hover:text-primary" />
                            <span className="text-xs">Botões</span>
                        </Button>
                        <Button variant="outline" className="h-auto py-3 flex flex-col gap-2 hover:bg-zinc-800 border-zinc-800" onClick={() => addAction('GENERIC_TEMPLATE')}>
                            <div className="relative">
                                <ImageIcon className="w-5 h-5 text-zinc-400" />
                                <Badge className="absolute -top-2 -right-3 text-[8px] h-3 px-1">Novo</Badge>
                            </div>
                            <span className="text-xs">Card Image</span>
                        </Button>
                        <Button variant="outline" className="h-auto py-3 flex flex-col gap-2 hover:bg-zinc-800 border-zinc-800" onClick={() => addAction('IMAGE')}>
                            <ImageIcon className="w-5 h-5 text-zinc-400 group-hover:text-primary" />
                            <span className="text-xs">Img Avulsa</span>
                        </Button>
                        <Button variant="outline" className="h-auto py-3 flex flex-col gap-2 hover:bg-zinc-800 border-zinc-800" onClick={() => addAction('AUDIO')}>
                            <FileAudio className="w-5 h-5 text-zinc-400 group-hover:text-primary" />
                            <span className="text-xs">Áudio</span>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
