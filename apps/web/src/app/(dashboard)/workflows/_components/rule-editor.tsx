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
    Loader2, Upload, FileAudio, Link as LinkIcon, RatioIcon,
    AlertTriangle, Info, Crop, CheckCircle2
} from "lucide-react"
import { CARD_FORMAT_CONFIGS, checkRatioMismatch, type CardFormat } from "@/lib/types/card-format"
import Link from "next/link"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"

interface RuleEditorProps {
    rule?: any
    mode: 'create' | 'edit'
}

type ButtonType = 'web_url' | 'postback'

interface ActionButton {
    type?: ButtonType // Legacy
    title?: string // Legacy
    url?: string // Legacy
    payload?: string // Legacy

    // New Structure
    label: string
    actionType: 'reply' | 'url' | 'flow_jump'
    value: string
}

function DelayInput({ valueMs, onChange }: { valueMs: number, onChange: (ms: number) => void }) {
    const [unit, setUnit] = useState<'seconds' | 'minutes' | 'hours'>('minutes')
    const [value, setValue] = useState(0)

    useEffect(() => {
        if (valueMs === 0) {
            setValue(0)
            return
        }

        if (valueMs % 3600000 === 0) {
            setUnit('hours')
            setValue(valueMs / 3600000)
        } else if (valueMs % 60000 === 0) {
            setUnit('minutes')
            setValue(valueMs / 60000)
        } else {
            setUnit('seconds')
            setValue(Math.floor(valueMs / 1000))
        }
    }, [valueMs]) // Only on mount or external change? Actually dependency on valueMs handles "external" updates correctly.

    const update = (v: number, u: string) => {
        let ms = 0
        if (u === 'seconds') ms = v * 1000
        if (u === 'minutes') ms = v * 60000
        if (u === 'hours') ms = v * 3600000
        onChange(ms)
        setValue(v)
        setUnit(u as any)
    }

    return (
        <div className="flex items-center gap-1 bg-black/20 rounded border border-zinc-800/50 p-1">
            <span className="text-[10px] text-zinc-500 pl-1">Delay:</span>
            <Input
                type="number"
                min={0}
                className="w-12 h-6 text-xs px-1 py-0 bg-transparent border-none focus-visible:ring-0 text-right"
                value={value}
                onChange={e => update(Number(e.target.value), unit)}
            />
            <Select value={unit} onValueChange={v => update(value, v)}>
                <SelectTrigger className="h-6 w-[70px] text-[10px] px-1 border-none bg-transparent focus:ring-0 gap-0">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="seconds">Seg</SelectItem>
                    <SelectItem value="minutes">Min</SelectItem>
                    <SelectItem value="hours">Horas</SelectItem>
                </SelectContent>
            </Select>
        </div>
    )
}

function migrateActions(actions: any[]) {
    const newActions: any[] = []

    // Helper to map old button to new format
    const mapBtn = (b: any) => {
        let actionType: any = 'reply'
        let value = ''

        if (b.type === 'web_url') {
            actionType = 'url'
            value = b.url || ''
        } else {
            if (b.payload && b.payload.startsWith('FLOW_JUMP::')) {
                actionType = 'flow_jump'
                value = b.payload.replace('FLOW_JUMP::', '')
            } else {
                actionType = 'reply'
                value = b.payload || b.title || ''
            }
        }

        return {
            label: b.title || b.label || 'Botão',
            actionType,
            value
        }
    }

    for (let i = 0; i < actions.length; i++) {
        const action = actions[i]

        // Merge TEXT + BUTTON_TEMPLATE sequence
        if (action.type === 'TEXT') {
            const nextAction = actions[i + 1]
            if (nextAction && nextAction.type === 'BUTTON_TEMPLATE' && (!nextAction.delayMs || nextAction.delayMs === 0)) {
                newActions.push({
                    type: 'MESSAGE_WITH_BUTTONS',
                    delayMs: action.delayMs,
                    payload: {
                        message: action.payload.text,
                        buttons: (nextAction.payload.buttons || []).map(mapBtn)
                    }
                })
                i++ // Skip next
                continue
            }

            // Convert TEXT to MESSAGE_WITH_BUTTONS
            newActions.push({
                type: 'MESSAGE_WITH_BUTTONS',
                delayMs: action.delayMs,
                payload: {
                    message: action.payload.text,
                    buttons: []
                }
            })
            continue
        }

        // Convert BUTTON_TEMPLATE to MESSAGE_WITH_BUTTONS
        if (action.type === 'BUTTON_TEMPLATE') {
            newActions.push({
                type: 'MESSAGE_WITH_BUTTONS',
                delayMs: action.delayMs,
                payload: {
                    message: action.payload.text,
                    buttons: (action.payload.buttons || []).map(mapBtn)
                }
            })
            continue
        }

        // Pass others through
        newActions.push(action)
    }
    return newActions
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

    // Trigger State
    const [triggerType, setTriggerType] = useState<string>(rule?.triggerType || 'MESSAGE_ANY')
    const [triggerConfig, setTriggerConfig] = useState<any>(rule?.triggerConfig || {})

    // Flow State
    const [flowEnabled, setFlowEnabled] = useState(rule?.flow?.enabled || false)
    const [flowSteps, setFlowSteps] = useState<any[]>(rule?.flow?.steps || [])

    // Page Selection State
    const [accounts, setAccounts] = useState<any[]>([])
    const [selectedPageIds, setSelectedPageIds] = useState<string[]>(rule?.pageIds || [])

    // Post Picker State
    const [posts, setPosts] = useState<any[]>([])
    const [postsLoading, setPostsLoading] = useState(false)
    const [postPickerOpen, setPostPickerOpen] = useState(false)

    // Load Posts Logic
    const fetchPosts = async () => {
        if (selectedPageIds.length !== 1) {
            toast.error("Selecione exatamente UMA página para buscar posts.")
            return
        }
        setPostsLoading(true)
        try {
            const res = await fetch(`/api/messenger/pages/${selectedPageIds[0]}/posts`)
            const data = await res.json()
            if (data.error) throw new Error(data.error)
            setPosts(data.posts || [])
            setPostPickerOpen(true)
        } catch (e: any) {
            toast.error(e.message || "Erro ao buscar posts")
        } finally {
            setPostsLoading(false)
        }
    }

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
    const [actions, setActions] = useState<any[]>(() => migrateActions(rule?.actions || []))

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
            case 'TEXT': return { text: '' } // Legacy
            case 'MESSAGE_WITH_BUTTONS': return { message: '', buttons: [] }
            case 'BUTTON_TEMPLATE': return { text: '', buttons: [] } // Legacy
            case 'GENERIC_TEMPLATE': return { title: '', subtitle: '', imageUrl: '', buttons: [], cardFormat: 'SQUARE', cropMode: 'NONE', derivedImageUrl: '' }
            case 'AUDIO': return { url: '' }
            case 'IMAGE': return { url: '' }
            default: return {}
        }
    }

    const getActionLabel = (type: string) => {
        switch (type) {
            case 'TEXT': return 'Texto (Antigo)'
            case 'MESSAGE_WITH_BUTTONS': return 'Mensagem'
            case 'BUTTON_TEMPLATE': return 'Botões (Antigo)'
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

    // Image dimension warnings per action
    const [imgWarnings, setImgWarnings] = useState<Record<number, string | null>>({})
    const [deriving, setDeriving] = useState<Record<number, boolean>>({})

    const checkImageDimensions = async (imageUrl: string, actionIdx: number, cardFormat: CardFormat) => {
        try {
            const res = await fetch('/api/card-image/derive', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl })
            })
            if (res.ok) {
                const dims = await res.json()
                const result = checkRatioMismatch(dims.width, dims.height, cardFormat)
                if (result.isMismatch) {
                    setImgWarnings(prev => ({ ...prev, [actionIdx]: `Sua imagem está em ${result.currentRatio}. ${result.recommendation}` }))
                } else {
                    setImgWarnings(prev => ({ ...prev, [actionIdx]: null }))
                }
            }
        } catch { /* silent */ }
    }

    const deriveImage = async (actionIdx: number, imageUrl: string, cardFormat: CardFormat) => {
        setDeriving(prev => ({ ...prev, [actionIdx]: true }))
        try {
            const res = await fetch('/api/card-image/derive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl, cardFormat })
            })
            if (res.ok) {
                const data = await res.json()
                updateAction(actionIdx, 'payload.derivedImageUrl', data.derivedUrl)
                toast.success(`Imagem recortada (${CARD_FORMAT_CONFIGS[cardFormat].idealLabel}) com sucesso!`)
                setImgWarnings(prev => ({ ...prev, [actionIdx]: null }))
            } else {
                const err = await res.json()
                toast.error('Erro ao recortar: ' + (err.error || 'Erro'))
            }
        } catch (error: any) {
            toast.error('Erro ao recortar: ' + error.message)
        } finally {
            setDeriving(prev => ({ ...prev, [actionIdx]: false }))
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, actionIdx: number, field: string = 'url') => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 20 * 1024 * 1024) {
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
            // Clear derived image when new original is uploaded
            if (field === 'imageUrl') {
                updateAction(actionIdx, 'payload.derivedImageUrl', '')
                // Check dimensions against card format
                const action = actions[actionIdx]
                const format = (action?.payload?.cardFormat || 'SQUARE') as CardFormat
                checkImageDimensions(publicUrl, actionIdx, format)
            }
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
        // New Format
        const newButtons = [...currentButtons, { label: 'Novo Botão', actionType: 'reply', value: '' }]
        updateAction(actionIdx, 'payload.buttons', newButtons)
    }

    const updateButton = (actionIdx: number, btnIdx: number, field: string, value: string) => {
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
            triggerType,
            triggerConfig,
            actions: flowEnabled ? [] : actions, // Clear actions if flow enabled
            flow: {
                enabled: flowEnabled,
                steps: flowEnabled ? flowSteps : []
            }
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

                            {/* NEW: Trigger Type Selector */}
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wider text-zinc-500">Tipo de Evento</Label>
                                <Select
                                    value={triggerType}
                                    onValueChange={(v) => {
                                        setTriggerType(v);
                                        // Reset/Set defaults based on type
                                        if (v === 'MESSAGE_OUTSIDE_24H') {
                                            setTriggerConfig((prev: any) => ({ ...prev, thresholdHours: 24, onlyIfReturning: true }));
                                        }
                                        if (v === 'COMMENT_ON_POST') {
                                            setTriggerConfig((prev: any) => ({ ...prev, ignoreOwnComments: true }));
                                        }
                                    }}
                                >
                                    <SelectTrigger className="bg-black/40 border-zinc-800">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MESSAGE_ANY">Mensagem Recebida (DM)</SelectItem>
                                        <SelectItem value="MESSAGE_OUTSIDE_24H">Reengajamento (Fora 24h)</SelectItem>
                                        <SelectItem value="COMMENT_ON_POST">Comentário em Post</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Page Selection */}
                            <div className="space-y-4 pb-4 border-b border-white/5">
                                <Label className="text-xs uppercase tracking-wider text-zinc-500">Páginas (Onde Executar)</Label>
                                {loading && accounts.length === 0 ? (
                                    <div className="text-xs text-zinc-500 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Carregando páginas...</div>
                                ) : accounts.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[150px] overflow-y-auto pr-1">
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
                                <Label className="text-xs uppercase tracking-wider text-zinc-500">Nome da Regra</Label>
                                <Input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Ex: Resposta Preços"
                                    className="bg-black/40 border-zinc-800 focus:border-primary/50"
                                />
                            </div>

                            {/* TRIGGER CONFIG: COMMENT_ON_POST */}
                            {triggerType === 'COMMENT_ON_POST' && (
                                <div className="space-y-4 pt-2 border-t border-white/5">
                                    <div className="space-y-2">
                                        <Label className="text-xs text-zinc-400">Post IDs Específicos (Opcional)</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="Digite ID do post e enter..."
                                                className="bg-black/40 border-zinc-800"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const val = e.currentTarget.value.trim();
                                                        if (val) {
                                                            const current = triggerConfig.postIds || [];
                                                            setTriggerConfig({ ...triggerConfig, postIds: [...current, val] });
                                                            e.currentTarget.value = '';
                                                        }
                                                    }
                                                }}
                                            />
                                            <Dialog open={postPickerOpen} onOpenChange={setPostPickerOpen}>
                                                <DialogTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        className="border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            fetchPosts();
                                                        }}
                                                        disabled={postsLoading}
                                                    >
                                                        {postsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Listar Posts"}
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-zinc-950 border-zinc-800 text-white">
                                                    <DialogHeader>
                                                        <DialogTitle>Selecionar Posts Recentes</DialogTitle>
                                                        <DialogDescription>Clique para adicionar/remover monitoramento.</DialogDescription>
                                                    </DialogHeader>

                                                    <div className="flex-1 overflow-y-auto p-1 space-y-2">
                                                        {posts.map(post => {
                                                            const isSelected = (triggerConfig.postIds || []).some((id: string) => post.id.endsWith(id));
                                                            return (
                                                                <div
                                                                    key={post.id}
                                                                    onClick={() => {
                                                                        const current = triggerConfig.postIds || [];
                                                                        let newIds;
                                                                        if (isSelected) {
                                                                            newIds = current.filter((id: string) => !post.id.endsWith(id));
                                                                        } else {
                                                                            newIds = [...current, post.id];
                                                                        }
                                                                        setTriggerConfig({ ...triggerConfig, postIds: newIds });
                                                                    }}
                                                                    className={`
                                                                        flex gap-4 p-3 rounded border transition-colors cursor-pointer
                                                                        ${isSelected ? 'bg-blue-500/10 border-blue-500/50' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}
                                                                    `}
                                                                >
                                                                    {post.full_picture && (
                                                                        <img src={post.full_picture} alt="" className="w-16 h-16 object-cover rounded" />
                                                                    )}
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm text-zinc-300 line-clamp-2">{post.message || '[Sem legenda]'}</p>
                                                                        <p className="text-xs text-zinc-500 mt-1">
                                                                            {new Date(post.created_time).toLocaleDateString()} • ID: {post.id}
                                                                        </p>
                                                                    </div>
                                                                    {isSelected && <div className="text-blue-500"><Plus className="w-5 h-5 rotate-45" /></div>}
                                                                </div>
                                                            )
                                                        })}
                                                        {posts.length === 0 && !postsLoading && <div className="p-4 text-center text-zinc-500">Nenhum post recente encontrado.</div>}
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {(triggerConfig.postIds || []).map((pid: string, i: number) => (
                                                <Badge key={i} variant="outline" className="text-[10px] border-zinc-700">
                                                    {pid} <Trash2 className="w-3 h-3 ml-1 cursor-pointer" onClick={() => {
                                                        const newIds = triggerConfig.postIds.filter((_: any, idx: number) => idx !== i);
                                                        setTriggerConfig({ ...triggerConfig, postIds: newIds });
                                                    }} />
                                                </Badge>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-zinc-500">Deixe vazio para monitorar TODOS os posts.</p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Switch
                                            id="ignore-own"
                                            checked={triggerConfig.ignoreOwnComments !== false}
                                            onCheckedChange={(c) => setTriggerConfig({ ...triggerConfig, ignoreOwnComments: c })}
                                        />
                                        <Label htmlFor="ignore-own" className="text-xs text-zinc-400">Ignorar comentários da própria página</Label>
                                    </div>
                                </div>
                            )}

                            {/* TRIGGER CONFIG: MESSAGE_OUTSIDE_24H */}
                            {triggerType === 'MESSAGE_OUTSIDE_24H' && (
                                <div className="space-y-4 pt-2 border-t border-white/5">
                                    <div className="space-y-2">
                                        <Label className="text-xs text-zinc-400">Limite de Tempo (Horas)</Label>
                                        <Input
                                            type="number"
                                            value={triggerConfig.thresholdHours || 24}
                                            onChange={e => setTriggerConfig({ ...triggerConfig, thresholdHours: Number(e.target.value) })}
                                            className="bg-black/40 border-zinc-800"
                                        />
                                        <p className="text-[10px] text-zinc-500">Tempo sem interação do usuário para considerar "Fora da Janela".</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Switch
                                            id="only-returning"
                                            checked={triggerConfig.onlyIfReturning !== false}
                                            onCheckedChange={(c) => setTriggerConfig({ ...triggerConfig, onlyIfReturning: c })}
                                        />
                                        <Label htmlFor="only-returning" className="text-xs text-zinc-400">Apenas usuários recorrentes (já interagiram antes)</Label>
                                    </div>
                                </div>
                            )}

                            {/* KEYWORDS: Relevant for ALL types actually, maybe optional for 24h */}
                            <div className="space-y-2 pt-2 border-t border-white/5">
                                <Label className="text-xs uppercase tracking-wider text-zinc-500">
                                    {triggerType === 'COMMENT_ON_POST' ? 'Palavras-chave no Comentário' : 'Palavras-chave na Mensagem'}
                                </Label>
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
                                        {keywords.length === 0 && <span className="text-xs text-zinc-600 block w-full text-center py-2">
                                            {triggerType === 'MESSAGE_OUTSIDE_24H' ? 'Qualquer mensagem (se vazio)' : 'Nenhuma palavra-chave'}
                                        </span>}
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

                {/* Right Column: Actions or Flow */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <h2 className="text-lg font-medium text-white flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-primary" />
                                Resposta
                            </h2>
                            <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800">
                                <span className={`text-xs ${!flowEnabled ? 'text-white font-medium' : 'text-zinc-500'}`}>Simples</span>
                                <Switch checked={flowEnabled} onCheckedChange={setFlowEnabled} />
                                <span className={`text-xs ${flowEnabled ? 'text-blue-400 font-medium' : 'text-zinc-500'}`}>Fluxo Conversacional</span>
                            </div>
                        </div>

                        {!flowEnabled && (
                            <Badge className="bg-zinc-800 text-zinc-400 hover:bg-zinc-800">{actions.length} ações</Badge>
                        )}
                    </div>

                    {flowEnabled ? (
                        <div className="space-y-6">
                            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-200">
                                <strong>Modo Conversacional:</strong> Crie perguntas e direcione o usuário com base nas respostas.
                            </div>

                            {flowSteps.map((step, sIdx) => (
                                <Card key={sIdx} className="bg-zinc-900/40 border-zinc-800">
                                    <CardHeader className="py-3 px-4 border-b border-white/5 flex flex-row items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="bg-blue-500/10 border-blue-500/30 text-blue-400">
                                                {step.id}
                                            </Badge>
                                            <Input
                                                className="w-24 h-7 text-xs bg-black/20 border-zinc-700"
                                                value={step.id}
                                                onChange={e => {
                                                    const newSteps = [...flowSteps]
                                                    newSteps[sIdx].id = e.target.value
                                                    setFlowSteps(newSteps)
                                                }}
                                            />
                                            <Select
                                                value={step.expectedType || 'any'}
                                                onValueChange={v => {
                                                    const newSteps = [...flowSteps]
                                                    newSteps[sIdx].expectedType = v
                                                    setFlowSteps(newSteps)
                                                }}
                                            >
                                                <SelectTrigger className="h-7 w-[110px] text-[10px] bg-black/40 border-zinc-700"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="any">Qualquer</SelectItem>
                                                    <SelectItem value="keyword">Texto Exato</SelectItem>
                                                    <SelectItem value="number">Número</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-red-400" onClick={() => {
                                            setFlowSteps(flowSteps.filter((_, i) => i !== sIdx))
                                        }}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </CardHeader>
                                    <CardContent className="p-4 space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs text-zinc-400">Pergunta / Mensagem</Label>
                                            <textarea
                                                className="flex w-full rounded-md border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white focus-visible:ring-1 focus-visible:ring-primary min-h-[60px]"
                                                value={step.message}
                                                onChange={e => {
                                                    const newSteps = [...flowSteps]
                                                    newSteps[sIdx].message = e.target.value
                                                    setFlowSteps(newSteps)
                                                }}
                                                placeholder="Ex: Qual sua cor favorita?"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-xs text-zinc-400">Condições (Se resposta for...)</Label>
                                                <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => {
                                                    const newSteps = [...flowSteps]
                                                    newSteps[sIdx].conditions = [...(step.conditions || []), { match: '', nextStep: '' }]
                                                    setFlowSteps(newSteps)
                                                }}>
                                                    + Condição
                                                </Button>
                                            </div>
                                            <div className="space-y-2">
                                                {(step.conditions || []).map((cond: any, cIdx: number) => (
                                                    <div key={cIdx} className="grid grid-cols-12 gap-2 p-2 bg-black/20 rounded border border-zinc-800/50 items-center">
                                                        <div className="col-span-4">
                                                            <Input
                                                                placeholder="Resposta exata"
                                                                className="h-7 text-xs bg-black/40 border-zinc-700"
                                                                value={cond.match}
                                                                onChange={e => {
                                                                    const newSteps = [...flowSteps]
                                                                    newSteps[sIdx].conditions[cIdx].match = e.target.value
                                                                    setFlowSteps(newSteps)
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="col-span-1 text-center text-zinc-500">→</div>
                                                        <div className="col-span-6">
                                                            <Input
                                                                placeholder="ID Próxima Etapa (Ex: step_2)"
                                                                className="h-7 text-xs bg-black/40 border-zinc-700"
                                                                value={cond.nextStep}
                                                                onChange={e => {
                                                                    const newSteps = [...flowSteps]
                                                                    newSteps[sIdx].conditions[cIdx].nextStep = e.target.value
                                                                    setFlowSteps(newSteps)
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="col-span-1 flex justify-end">
                                                            <Trash2 className="w-3.5 h-3.5 text-zinc-600 cursor-pointer hover:text-red-400" onClick={() => {
                                                                const newSteps = [...flowSteps]
                                                                newSteps[sIdx].conditions = step.conditions.filter((_: any, i: number) => i !== cIdx)
                                                                setFlowSteps(newSteps)
                                                            }} />
                                                        </div>
                                                    </div>
                                                ))}
                                                {(step.conditions || []).length === 0 && (
                                                    <div className="text-[10px] text-zinc-500 text-center py-2 border border-dashed border-zinc-800 rounded">
                                                        Sem condições. O fluxo para aqui ou usa Fallback.
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-2 pt-2 border-t border-white/5">
                                            <Label className="text-xs text-zinc-400">Fallback (Se não bater nenhuma condição)</Label>
                                            <Input
                                                className="h-8 text-xs bg-black/40 border-zinc-700"
                                                placeholder="Ex: Não entendi, fale 1 ou 2."
                                                value={step.fallback?.message || ''}
                                                onChange={e => {
                                                    const newSteps = [...flowSteps]
                                                    newSteps[sIdx].fallback = { message: e.target.value }
                                                    setFlowSteps(newSteps)
                                                }}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}

                            <Button
                                variant="outline"
                                className="w-full border-dashed border-zinc-700 hover:border-blue-500 hover:bg-blue-500/5 text-zinc-400"
                                onClick={() => {
                                    const nextId = `step_${flowSteps.length + 1}`
                                    setFlowSteps([...flowSteps, { id: nextId, type: 'question', message: '', conditions: [] }])
                                }}
                            >
                                <Plus className="w-4 h-4 mr-2" /> Adicionar Etapa
                            </Button>
                        </div>
                    ) : (
                        // SIMPLE MODE (ACTIONS)
                        <>
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
                                                    <DelayInput
                                                        valueMs={action.delayMs || 0}
                                                        onChange={(ms) => updateAction(idx, 'delayMs', ms)}
                                                    />
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md" onClick={() => removeAction(idx)}>
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-4">
                                                {/* MESSAGE WITH BUTTONS EDITOR (Also handles migrated TEXT and BUTTON_TEMPLATE) */}
                                                {(action.type === 'MESSAGE_WITH_BUTTONS' || action.type === 'TEXT' || action.type === 'BUTTON_TEMPLATE') && (
                                                    <div className="space-y-4">
                                                        <div className="space-y-2">
                                                            <Label className="text-xs text-zinc-400">Mensagem</Label>
                                                            <textarea
                                                                className="flex w-full rounded-md border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary min-h-[80px]"
                                                                value={action.payload.message || action.payload.text || ''}
                                                                onChange={e => updateAction(idx, 'payload.message', e.target.value)}
                                                                placeholder="Digite sua mensagem aqui..."
                                                            />
                                                        </div>

                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <Label className="text-xs text-zinc-400">Botões (Opcional - Max 3)</Label>
                                                                <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => addButtonToPayload(idx)} disabled={(action.payload.buttons?.length || 0) >= 3}>
                                                                    <Plus className="w-3 h-3 mr-1" /> Add Botão
                                                                </Button>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {(action.payload.buttons || []).map((btn: any, btnIndex: number) => (
                                                                    <div key={btnIndex} className="grid grid-cols-12 gap-2 bg-black/20 p-2 rounded border border-zinc-800 items-start">
                                                                        <div className="col-span-3">
                                                                            <Select value={btn.actionType || 'reply'} onValueChange={v => updateButton(idx, btnIndex, 'actionType', v)}>
                                                                                <SelectTrigger className="h-7 text-[10px] bg-black/40 border-zinc-700"><SelectValue /></SelectTrigger>
                                                                                <SelectContent>
                                                                                    <SelectItem value="reply">Responder</SelectItem>
                                                                                    <SelectItem value="url">Abrir Link</SelectItem>
                                                                                    <SelectItem value="flow_jump">Ir p/ Fluxo</SelectItem>
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </div>
                                                                        <div className="col-span-4">
                                                                            <Input
                                                                                className="h-7 text-[10px] bg-black/40 border-zinc-700"
                                                                                placeholder="Label do Botão"
                                                                                value={btn.label || btn.title || ''}
                                                                                onChange={e => updateButton(idx, btnIndex, 'label', e.target.value)}
                                                                            />
                                                                        </div>
                                                                        <div className="col-span-4">
                                                                            <Input
                                                                                className="h-7 text-[10px] bg-black/40 border-zinc-700"
                                                                                placeholder={btn.actionType === 'url' ? 'https://...' : (btn.actionType === 'flow_jump' ? 'ID do Fluxo' : 'Mensagem/Payload')}
                                                                                value={btn.value || btn.url || btn.payload || ''}
                                                                                onChange={e => updateButton(idx, btnIndex, 'value', e.target.value)}
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
                                                                    <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                        <Upload className="w-6 h-6 text-white" />
                                                                    </div>
                                                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, idx, 'imageUrl')} />
                                                                </div>
                                                            </label>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Removed old BUTTON_TEMPLATE editor as it is merged into MESSAGE_WITH_BUTTONS */}

                                                {/* GENERIC TEMPLATE (CARD WITH IMAGE) EDITOR */}
                                                {action.type === 'GENERIC_TEMPLATE' && (() => {
                                                    const fmt = (action.payload.cardFormat || 'SQUARE') as CardFormat
                                                    const fmtConfig = CARD_FORMAT_CONFIGS[fmt] || CARD_FORMAT_CONFIGS.SQUARE
                                                    return (
                                                        <div className="space-y-3">
                                                            {/* Format Selector */}
                                                            <div className="flex items-center gap-3 p-3 rounded-lg bg-black/20 border border-zinc-800/50">
                                                                <RatioIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                                                                <div className="flex-1 min-w-0">
                                                                    <Label className="text-xs text-zinc-300 font-medium">Formato do Card (preview)</Label>
                                                                    <p className="text-[10px] text-zinc-500 mt-0.5">Tamanho ideal: {fmtConfig.idealLabel}</p>
                                                                </div>
                                                                <Select
                                                                    value={fmt}
                                                                    onValueChange={v => {
                                                                        updateAction(idx, 'payload.cardFormat', v)
                                                                        updateAction(idx, 'payload.derivedImageUrl', '')
                                                                        if (action.payload.imageUrl) {
                                                                            checkImageDimensions(action.payload.imageUrl, idx, v as CardFormat)
                                                                        }
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="w-[200px] h-8 text-xs bg-black/40 border-zinc-700">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="SQUARE">Quadrado (1:1)</SelectItem>
                                                                        <SelectItem value="PORTRAIT">Retrato (4:5)</SelectItem>
                                                                        <SelectItem value="LANDSCAPE">Paisagem (1.91:1)</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>

                                                            {/* Fixed disclaimer */}
                                                            <div className="flex items-start gap-2 px-3 py-2 rounded bg-blue-500/10 border border-blue-500/20">
                                                                <Info className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                                                                <p className="text-[10px] text-blue-300/80 leading-relaxed">
                                                                    O preview segue o formato escolhido. No Messenger, o formato final pode variar conforme o app/dispositivo.
                                                                </p>
                                                            </div>

                                                            {/* Dimension mismatch warning */}
                                                            {imgWarnings[idx] && (
                                                                <div className="flex items-start gap-2 px-3 py-2 rounded bg-amber-500/10 border border-amber-500/20">
                                                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                                                                    <p className="text-[10px] text-amber-300/80">{imgWarnings[idx]}</p>
                                                                </div>
                                                            )}

                                                            {/* Crop Mode Toggle */}
                                                            <div className="flex items-center gap-3 p-3 rounded-lg bg-black/20 border border-zinc-800/50">
                                                                <Crop className="w-4 h-4 text-zinc-400 shrink-0" />
                                                                <div className="flex-1 min-w-0">
                                                                    <Label className="text-xs text-zinc-300 font-medium">Recorte Automático</Label>
                                                                    <p className="text-[10px] text-zinc-500 mt-0.5">Gera imagem recortada para o formato antes de enviar</p>
                                                                </div>
                                                                <Switch
                                                                    checked={action.payload.cropMode === 'AUTO_CENTER_CROP'}
                                                                    onCheckedChange={(checked) => {
                                                                        updateAction(idx, 'payload.cropMode', checked ? 'AUTO_CENTER_CROP' : 'NONE')
                                                                        if (!checked) {
                                                                            updateAction(idx, 'payload.derivedImageUrl', '')
                                                                        }
                                                                    }}
                                                                />
                                                            </div>

                                                            {/* Auto-derive button */}
                                                            {action.payload.cropMode === 'AUTO_CENTER_CROP' && action.payload.imageUrl && !action.payload.derivedImageUrl && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="w-full h-8 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                                                    onClick={() => deriveImage(idx, action.payload.imageUrl, fmt)}
                                                                    disabled={deriving[idx]}
                                                                >
                                                                    {deriving[idx] ? (
                                                                        <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> Recortando...</>
                                                                    ) : (
                                                                        <><Crop className="w-3 h-3 mr-2" /> Gerar Imagem Recortada ({fmtConfig.idealLabel})</>
                                                                    )}
                                                                </Button>
                                                            )}

                                                            {action.payload.derivedImageUrl && (
                                                                <div className="flex items-center gap-2 px-3 py-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                                                    <p className="text-[10px] text-emerald-300/80 flex-1">
                                                                        Imagem recortada salva ({fmtConfig.idealLabel}). Será usada ao enviar.
                                                                    </p>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-5 text-[9px] text-zinc-400 hover:text-red-400 px-2"
                                                                        onClick={() => updateAction(idx, 'payload.derivedImageUrl', '')}
                                                                    >
                                                                        Remover
                                                                    </Button>
                                                                </div>
                                                            )}

                                                            <div className="flex flex-col md:flex-row gap-4">
                                                                {/* Image Upload Area with aspect ratio preview */}
                                                                <div className="w-full md:w-1/3 shrink-0">
                                                                    <label className="cursor-pointer block">
                                                                        <div
                                                                            className="rounded-lg border-2 border-dashed border-zinc-700 hover:border-primary/50 transition-all bg-black/20 flex flex-col items-center justify-center overflow-hidden relative"
                                                                            style={{ aspectRatio: fmtConfig.cssAspectRatio }}
                                                                        >
                                                                            {action.payload.imageUrl ? (
                                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                                <img
                                                                                    src={action.payload.derivedImageUrl || action.payload.imageUrl}
                                                                                    alt="Card Cover"
                                                                                    className="absolute inset-0 w-full h-full object-cover"
                                                                                    style={{ objectPosition: 'center' }}
                                                                                />
                                                                            ) : (
                                                                                <div className="text-center p-4">
                                                                                    {uploading[idx] ? <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-zinc-500" /> : <ImageIcon className="w-6 h-6 mx-auto mb-2 text-zinc-500" />}
                                                                                    <span className="text-[10px] text-zinc-400 block">Capa do Card</span>
                                                                                    <span className="text-[9px] text-zinc-500 block mt-1">{fmtConfig.label}</span>
                                                                                </div>
                                                                            )}
                                                                            <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                                <Upload className="w-6 h-6 text-white" />
                                                                            </div>
                                                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, idx, 'imageUrl')} />
                                                                        </div>
                                                                    </label>
                                                                    {/* Safe area recommendation */}
                                                                    <p className="text-[9px] text-zinc-600 mt-1 text-center">
                                                                        Safe area: margem interna 8-12% do tamanho
                                                                    </p>
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
                                                        </div>
                                                    )
                                                })()}

                                            </CardContent>
                                        </Card>
                                    </div>
                                ))}
                            </div>

                            {/* Add Action Bar (Bottom Sticky or just Block) */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-4 border-t border-zinc-800">
                                <Button variant="outline" className="h-auto py-3 flex flex-col gap-2 hover:bg-zinc-800 border-zinc-800" onClick={() => addAction('MESSAGE_WITH_BUTTONS')}>
                                    <MessageSquare className="w-5 h-5 text-zinc-400 group-hover:text-primary" />
                                    <span className="text-xs">Mensagem</span>
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
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

