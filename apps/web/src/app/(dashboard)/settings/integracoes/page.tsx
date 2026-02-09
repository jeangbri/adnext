"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MessageCircle, RefreshCw, CheckCircle, Smartphone, Settings, Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { getProjects, updatePageProject } from "@/app/actions/projects"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function IntegrationsPage() {
    const [loading, setLoading] = useState(true)
    const [accounts, setAccounts] = useState<any[]>([])
    const [projects, setProjects] = useState<any[]>([])
    const [rules, setRules] = useState<any[]>([])

    // Config Dialog State
    const [configOpen, setConfigOpen] = useState(false)
    const [selectedAccount, setSelectedAccount] = useState<any>(null)
    const [getStartedPayload, setGetStartedPayload] = useState('')
    const [iceBreakers, setIceBreakers] = useState<{ question: string, payload: string }[]>([])

    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        fetchStatus()
        loadProjects()
    }, [])

    const loadProjects = async () => {
        const data = await getProjects()
        setProjects(data)
    }

    const loadRules = async () => {
        try {
            const res = await fetch('/api/automations')
            if (res.ok) {
                const data = await res.json()
                setRules(data)
            }
        } catch (e) { console.error("Failed to load rules", e) }
    }

    const handleProjectChange = async (pageId: string, projectId: string) => {
        try {
            await updatePageProject(pageId, projectId)
            toast.success("Projeto atualizado!")
            fetchStatus()
        } catch (e) {
            toast.error("Erro ao atualizar projeto")
        }
    }

    const fetchStatus = async () => {
        try {
            setLoading(true)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const res = await fetch('/api/messenger/status')
            if (res.ok) {
                const data = await res.json()
                setAccounts(data.accounts || [])
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const handleConnect = () => {
        window.location.href = '/api/messenger/connect'
    }

    const handleRevalidate = () => {
        window.location.href = '/api/messenger/connect?revalidate=true'
    }

    const handleTestSend = async (pageId: string) => {
        try {
            setLoading(true)
            const res = await fetch('/api/test/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pageId })
            })
            const data = await res.json()
            if (res.ok) {
                alert(`Mensagem enviada para ${data.recipient}!`)
            } else {
                alert('Erro: ' + data.error)
            }
        } catch (e) {
            alert('Erro ao enviar teste')
        } finally {
            setLoading(false)
        }
    }

    const handleOpenConfig = (account: any) => {
        setSelectedAccount(account)
        setGetStartedPayload(account.getStartedPayload || '')
        const rawBreakers = account.iceBreakers && Array.isArray(account.iceBreakers) ? account.iceBreakers : []
        const normalizedBreakers = rawBreakers.map((ib: any) => ({
            question: ib.question || '',
            payload: ib.payload || ''
        }))
        setIceBreakers(normalizedBreakers)
        loadRules();
        setConfigOpen(true)
    }

    const handleSaveConfig = async () => {
        if (!selectedAccount) return

        try {
            setLoading(true)
            const res = await fetch('/api/messenger/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pageId: selectedAccount.pageId,
                    getStartedPayload,
                    iceBreakers
                })
            })

            const data = await res.json()
            if (res.ok) {
                toast.success('Configurações salvas e enviadas para o Facebook!')
                setConfigOpen(false)
                fetchStatus() // Refresh to update local state
            } else {
                toast.error('Erro: ' + data.error)
            }
        } catch (e) {
            toast.error('Erro ao salvar configurações')
        } finally {
            setLoading(false)
        }
    }

    const handleDisconnect = async () => {
        if (!confirm("ATENÇÃO: Isso removerá todas as conexões de páginas, histórico de mensagens e campanhas associadas. Os contatos serão mantidos mas desvinculados. Tem certeza?")) return

        try {
            setLoading(true)
            const res = await fetch('/api/messenger/disconnect', { method: 'POST' })
            if (res.ok) {
                toast.success("Todas as conexões foram removidas.")
                fetchStatus()
            } else {
                const data = await res.json()
                toast.error("Erro: " + data.error)
            }
        } catch (e) {
            toast.error("Falha ao desconectar")
        } finally {
            setLoading(false)
        }
    }

    const addIceBreaker = () => {
        if (iceBreakers.length >= 4) {
            toast.error('Máximo de 4 perguntas frequentes')
            return
        }
        setIceBreakers([...iceBreakers, { question: '', payload: '' }])
    }

    const updateIceBreaker = (idx: number, field: 'question' | 'payload', value: string) => {
        const newBreakers = [...iceBreakers]
        newBreakers[idx][field] = value
        setIceBreakers(newBreakers)
    }

    const removeIceBreaker = (idx: number) => {
        setIceBreakers(iceBreakers.filter((_, i) => i !== idx))
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-white">Integrações</h2>
                <p className="text-zinc-400">Gerencie a conexão com suas Páginas do Facebook para automação no Messenger.</p>
            </div>

            <Card className="border-zinc-800 bg-zinc-900/50">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                                <MessageCircle className="h-6 w-6 text-primary" fill="currentColor" />
                            </div>
                            <div>
                                <CardTitle className="text-white">Messenger & Facebook</CardTitle>
                                <CardDescription className="text-zinc-400">Conecte suas Páginas para responder automaticamente.</CardDescription>
                            </div>
                        </div>
                        {accounts.length > 0 ? (
                            <div className="flex gap-2">
                                <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
                                    <CheckCircle className="w-3 h-3 mr-1" /> {accounts.length} Conectado(s)
                                </Badge>
                                <Button variant="outline" size="sm" onClick={handleRevalidate} className="h-6 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white">
                                    <RefreshCw className="w-3 h-3 mr-1" />
                                    Revalidar / Adicionar Mais
                                </Button>
                            </div>
                        ) : (
                            <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 border-zinc-700">Desconectado</Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="h-20 animate-pulse bg-zinc-800 rounded-md" />
                    ) : accounts.length > 0 ? (
                        <div className="space-y-3">
                            {accounts.map((account) => (
                                <div key={account.id} className="rounded-xl border border-zinc-800 p-4 bg-black/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                                            {account.pageName.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-white text-lg">{account.pageName}</p>
                                            <p className="text-xs text-zinc-500 font-mono">Page ID: {account.pageId}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 min-w-[200px]">
                                        <Select
                                            defaultValue={account.project?.id || "unassigned"}
                                            onValueChange={(val) => handleProjectChange(account.pageId, val)}
                                            disabled={loading}
                                        >
                                            <SelectTrigger className="w-[180px] bg-zinc-900 border-zinc-700 text-xs h-8">
                                                <SelectValue placeholder="Selecione Projeto" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                                <SelectItem value="unassigned" disabled>Sem Projeto</SelectItem>
                                                {projects.map(p => (
                                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => handleOpenConfig(account)} disabled={loading} className="border-zinc-700 hover:bg-zinc-800 text-zinc-300">
                                            <Settings className="w-4 h-4 mr-2" />
                                            Configurar
                                        </Button>
                                        <Button variant="secondary" size="sm" onClick={() => handleTestSend(account.pageId)} disabled={loading}>
                                            <Smartphone className="w-4 h-4 mr-2" />
                                            Testar Envio
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-sm text-zinc-500">
                            Nenhuma página conectada. Clique no botão abaixo para conectar com o Facebook.
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex gap-2">
                    {accounts.length === 0 ? (
                        <Button onClick={handleConnect} disabled={loading} className="bg-[#0084FF] hover:bg-[#0084FF]/90 text-white shadow-[0_0_20px_-5px_rgba(0,132,255,0.3)]">
                            Conectar Facebook Page
                        </Button>
                    ) : (
                        <Button onClick={handleDisconnect} disabled={loading} variant="destructive" className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20 border">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Desconectar Tudo (Reset)
                        </Button>
                    )}
                </CardFooter>
            </Card>

            <Dialog open={configOpen} onOpenChange={setConfigOpen}>
                <DialogContent className="bg-zinc-950 border-zinc-800 text-white sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Configurar Página</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Defina o botão "Começar" e perguntas frequentes (Ice Breakers).
                        </DialogDescription>
                    </DialogHeader>

                    {selectedAccount && (
                        <div className="space-y-6 py-4">
                            <div className="flex items-center gap-3 p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold">
                                    {selectedAccount.pageName.charAt(0)}
                                </div>
                                <div>
                                    <p className="font-medium text-sm">{selectedAccount.pageName}</p>
                                    <p className="text-xs text-zinc-500">ID: {selectedAccount.pageId}</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-xs uppercase tracking-wider text-zinc-500">Botão Começar (Get Started)</Label>
                                <div className="space-y-2">
                                    <Select
                                        value={(getStartedPayload || '').startsWith('FLOW_JUMP::') ? getStartedPayload : (getStartedPayload ? 'custom' : 'none')}
                                        onValueChange={(v) => {
                                            if (v === 'custom' || v === 'none') setGetStartedPayload('')
                                            else setGetStartedPayload(v)
                                        }}
                                    >
                                        <SelectTrigger className="bg-zinc-900 border-zinc-800">
                                            <SelectValue placeholder="Selecione uma Automação" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                            <SelectItem value="none">Nenhuma Ação</SelectItem>
                                            <SelectItem value="custom">Texto / Payload Customizado</SelectItem>
                                            {rules.map(rule => (
                                                <SelectItem key={rule.id} value={`FLOW_JUMP::${rule.id}`}>📦 {rule.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    {(!(getStartedPayload || '').startsWith('FLOW_JUMP::') && getStartedPayload !== '' || getStartedPayload === 'custom' || (getStartedPayload && !getStartedPayload.includes('::'))) && (
                                        <Input
                                            value={getStartedPayload || ''}
                                            onChange={e => setGetStartedPayload(e.target.value)}
                                            placeholder="Digite o Payload ou Texto..."
                                            className="bg-zinc-900 border-zinc-800"
                                        />
                                    )}
                                    <p className="text-[10px] text-zinc-500">
                                        Escolha uma automação para iniciar quando o usuário clicar em "Começar".
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs uppercase tracking-wider text-zinc-500">Perguntas Frequentes</Label>
                                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs hover:bg-zinc-800" onClick={addIceBreaker}>
                                        <Plus className="w-3 h-3 mr-1" /> Adicionar
                                    </Button>
                                </div>
                                <div className="space-y-3">
                                    {iceBreakers.map((ib, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                                            <div className="col-span-12 sm:col-span-6">
                                                <Input
                                                    value={ib.question}
                                                    onChange={e => updateIceBreaker(idx, 'question', e.target.value)}
                                                    placeholder="Pergunta (Ex: Preços?)"
                                                    className="bg-zinc-900 border-zinc-800 h-9 text-xs"
                                                />
                                            </div>
                                            <div className="col-span-10 sm:col-span-5">
                                                <Select
                                                    value={(ib.payload || '').startsWith('FLOW_JUMP::') ? ib.payload : 'custom'}
                                                    onValueChange={(v) => {
                                                        if (v === 'custom') updateIceBreaker(idx, 'payload', '')
                                                        else updateIceBreaker(idx, 'payload', v)
                                                    }}
                                                >
                                                    <SelectTrigger className="bg-zinc-900 border-zinc-800 h-9 text-xs">
                                                        <SelectValue placeholder="Ação" />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                                        <SelectItem value="custom">Customizado</SelectItem>
                                                        {rules.map(rule => (
                                                            <SelectItem key={rule.id} value={`FLOW_JUMP::${rule.id}`}>📦 {rule.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            {!(ib.payload || '').startsWith('FLOW_JUMP::') && (
                                                <div className="col-span-12 mt-1">
                                                    <Input
                                                        value={ib.payload || ''}
                                                        onChange={e => updateIceBreaker(idx, 'payload', e.target.value)}
                                                        placeholder="Payload manual..."
                                                        className="bg-zinc-900 border-zinc-800 h-8 text-[10px] opacity-70"
                                                    />
                                                </div>
                                            )}
                                            <div className="col-span-2 sm:col-span-1 flex justify-end">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-400 hover:bg-red-500/10" onClick={() => removeIceBreaker(idx)}>
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    {iceBreakers.length === 0 && (
                                        <div className="text-center py-4 bg-zinc-900/50 rounded border border-dashed border-zinc-800 text-xs text-zinc-500">
                                            Nenhuma pergunta definida
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setConfigOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveConfig} disabled={loading} className="bg-[#0084FF] hover:bg-[#0084FF]/90 text-white">
                            Salvar Alterações
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
