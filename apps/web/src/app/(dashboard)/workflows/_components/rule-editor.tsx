"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Save, ArrowLeft } from "lucide-react"
import Link from "next/link"

interface RuleEditorProps {
    rule?: any
    mode: 'create' | 'edit'
}

export function RuleEditor({ rule, mode }: RuleEditorProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    // Form State
    const [name, setName] = useState(rule?.name || '')
    const [isActive, setIsActive] = useState(rule?.isActive ?? true)
    const [priority, setPriority] = useState(rule?.priority || 0)
    const [cooldown, setCooldown] = useState(rule?.cooldownSeconds || 0)

    // Match State
    const [matchType, setMatchType] = useState(rule?.matchType || 'CONTAINS')
    const [matchOperator, setMatchOperator] = useState(rule?.matchOperator || 'ANY') // unused in UI but handling state
    const [keywordInput, setKeywordInput] = useState('')
    const [keywords, setKeywords] = useState<string[]>(rule?.keywords || [])

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
            payload: type === 'TEXT' ? { text: '' } : type === 'BUTTON_TEMPLATE' ? { text: '', buttons: [] } : {}
        }
        setActions([...actions, newAction])
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

    const handleSave = async () => {
        setLoading(true)
        const payload = {
            name,
            isActive,
            priority: Number(priority),
            cooldownSeconds: Number(cooldown),
            matchType,
            matchOperator,
            keywords,
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

            router.push('/workflows')
            router.refresh()
        } catch (e) {
            console.error(e)
            alert('Erro ao salvar')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-20">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/workflows">
                        <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
                    </Link>
                    <h1 className="text-2xl font-bold text-white">{mode === 'create' ? 'Nova Regra' : 'Editar Regra'}</h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Switch checked={isActive} onCheckedChange={setIsActive} />
                        <span className="text-sm text-zinc-400">{isActive ? 'Ativo' : 'Pausado'}</span>
                    </div>
                    <Button onClick={handleSave} disabled={loading} className="bg-primary text-white">
                        <Save className="w-4 h-4 mr-2" /> Salvar
                    </Button>
                </div>
            </div>

            {/* Configurações Básicas */}
            <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader><CardTitle className="text-white">Gatilho e Configurações</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Nome da Regra</Label>
                            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Boas vindas" className="bg-black/20 border-zinc-700" />
                        </div>
                        <div className="space-y-2">
                            <Label>Prioridade (Maior vence)</Label>
                            <Input type="number" value={priority} onChange={e => setPriority(Number(e.target.value))} className="bg-black/20 border-zinc-700" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Match Type</Label>
                            {/* Native Select */}
                            <select
                                value={matchType}
                                onChange={e => setMatchType(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-zinc-700 bg-black/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="CONTAINS">Contém</option>
                                <option value="EXACT">Exato</option>
                                <option value="STARTS_WITH">Começa com</option>
                                <option value="REGEX">Regex</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Cooldown (segundos)</Label>
                            <Input type="number" value={cooldown} onChange={e => setCooldown(Number(e.target.value))} className="bg-black/20 border-zinc-700" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Palavras-chave (Enter para adicionar)</Label>
                        <div className="flex gap-2">
                            <Input
                                value={keywordInput}
                                onChange={e => setKeywordInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addKeyword()}
                                placeholder="digite e pressione enter..."
                                className="bg-black/20 border-zinc-700"
                            />
                            <Button variant="secondary" onClick={addKeyword}><Plus className="w-4 h-4" /></Button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {keywords.map((k, i) => (
                                <div key={i} className="flex items-center gap-1 bg-primary/20 text-primary px-3 py-1 rounded-full text-sm">
                                    {k}
                                    <Trash2 className="w-3 h-3 cursor-pointer hover:text-red-500" onClick={() => removeKeyword(i)} />
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Actions */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">Ações de Resposta</h2>
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => addAction('TEXT')}>+ Texto</Button>
                        <Button size="sm" variant="outline" onClick={() => addAction('BUTTON_TEMPLATE')}>+ Botões</Button>
                        <Button size="sm" variant="outline" onClick={() => addAction('AUDIO')}>+ Áudio</Button>
                    </div>
                </div>

                {actions.map((action, idx) => (
                    <Card key={idx} className="bg-zinc-900/30 border-zinc-800">
                        <CardContent className="pt-6 space-y-4">
                            <div className="flex justify-between items-start">
                                <Badge variant="outline">{action.type}</Badge>
                                <Button variant="ghost" size="sm" onClick={() => removeAction(idx)} className="text-red-500 hover:text-red-400 hover:bg-red-500/10">Remove</Button>
                            </div>

                            {/* Delay */}
                            <div className="flex items-center gap-2">
                                <Label className="whitespace-nowrap">Delay (ms):</Label>
                                <Input
                                    type="number"
                                    value={action.delayMs}
                                    onChange={e => updateAction(idx, 'delayMs', Number(e.target.value))}
                                    className="w-24 h-8 bg-black/20"
                                />
                            </div>

                            {/* Payload Fields */}
                            {action.type === 'TEXT' && (
                                <div className="space-y-2">
                                    <Label>Mensagem de Texto</Label>
                                    <textarea
                                        className="flex w-full rounded-md border border-zinc-700 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                        rows={3}
                                        value={action.payload.text || ''}
                                        onChange={e => updateAction(idx, 'payload.text', e.target.value)}
                                    />
                                </div>
                            )}

                            {action.type === 'BUTTON_TEMPLATE' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Texto do Cartão</Label>
                                        <Input
                                            value={action.payload.text || ''}
                                            onChange={e => updateAction(idx, 'payload.text', e.target.value)}
                                            className="bg-black/20 border-zinc-700"
                                        />
                                    </div>
                                    <div className="space-y-2 border-l-2 border-zinc-700 pl-4">
                                        <Label>Botões (Máx 3) - Edite via JSON por enquanto</Label>
                                        <div className="text-xs text-zinc-500 mb-2">Formato: URL, Título. Implementação simplificada.</div>
                                        {/* Simplified Button Editor: Just JSON for now to save complexity */}
                                        <textarea
                                            className="font-mono text-xs w-full bg-black/40 border-zinc-800 rounded p-2"
                                            rows={5}
                                            value={JSON.stringify(action.payload.buttons || [], null, 2)}
                                            onChange={e => {
                                                try {
                                                    const b = JSON.parse(e.target.value)
                                                    updateAction(idx, 'payload.buttons', b)
                                                } catch (err) { }
                                            }}
                                        />
                                        <p className="text-xs text-zinc-600">Ex: {`[{"type":"web_url","url":"https://google.com","title":"Visitar site"}]`}</p>
                                    </div>
                                </div>
                            )}

                            {action.type === 'AUDIO' && (
                                <div className="space-y-2">
                                    <Label>URL do Arquivo de Áudio</Label>
                                    <Input
                                        value={action.payload.url || ''}
                                        onChange={e => updateAction(idx, 'payload.url', e.target.value)}
                                        placeholder="https://example.com/audio.mp3"
                                        className="bg-black/20 border-zinc-700"
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
