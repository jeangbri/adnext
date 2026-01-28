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
    const [account, setAccount] = useState<any>(null)
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
                setAccount(data.account)
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
                                <CardDescription className="text-zinc-400">Conecte sua Página para responder automaticamente.</CardDescription>
                            </div>
                        </div>
                        {account?.status === 'CONNECTED' ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
                                <CheckCircle className="w-3 h-3 mr-1" /> Conectado
                            </Badge>
                        ) : (
                            <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 border-zinc-700">Desconectado</Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="h-20 animate-pulse bg-zinc-800 rounded-md" />
                    ) : account ? (
                        <div className="rounded-xl border border-zinc-800 p-4 bg-black/20">
                            <div className="flex items-center gap-4">
                                {account.profilePicUrl ? (
                                    <img src={account.profilePicUrl} alt={account.name} className="w-12 h-12 rounded-full ring-2 ring-primary/20" />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                                        <Smartphone className="w-6 h-6 text-zinc-500" />
                                    </div>
                                )}
                                <div>
                                    <p className="font-semibold text-white text-lg">{account.name}</p>
                                    <p className="text-xs text-zinc-500 font-mono">Page ID: {account.providerAccountId}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-zinc-500">
                            Nenhuma página conectada. Clique no botão abaixo para conectar com o Facebook.
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex gap-2">
                    {!account || account.status !== 'CONNECTED' ? (
                        <Button onClick={handleConnect} disabled={loading} className="bg-primary hover:bg-primary/90 text-white shadow-[0_0_20px_-5px_rgba(0,132,255,0.3)]">
                            Conectar Facebook Page
                        </Button>
                    ) : (
                        <Button variant="outline" onClick={handleRevalidate} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white">
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Revalidar Conexão
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    )
}
