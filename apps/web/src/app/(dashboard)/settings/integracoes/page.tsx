"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MessageCircle, RefreshCw, CheckCircle, Smartphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function IntegrationsPage() {
    const [loading, setLoading] = useState(true)
    const [accounts, setAccounts] = useState<any[]>([])
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        fetchStatus()
    }, [])

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
                                    <Button variant="secondary" size="sm" onClick={() => handleTestSend(account.pageId)} disabled={loading}>
                                        <Smartphone className="w-4 h-4 mr-2" />
                                        Testar Envio
                                    </Button>
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
                    {accounts.length === 0 && (
                        <Button onClick={handleConnect} disabled={loading} className="bg-primary hover:bg-primary/90 text-white shadow-[0_0_20px_-5px_rgba(0,132,255,0.3)]">
                            Conectar Facebook Page
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    )
}
