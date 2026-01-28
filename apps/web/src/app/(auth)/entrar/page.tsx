

"use client"

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Lock, Mail, ArrowRight, MessageCircle } from 'lucide-react'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) {
                toast.error('Erro ao entrar: ' + error.message)
            } else {
                toast.success('Login realizado com sucesso!')
                router.push('/dashboard')
                router.refresh()
            }
        } catch (err) {
            toast.error('Ocorreu um erro inesperado')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-8">
            {/* Header Section */}
            <div className="flex flex-col items-center justify-center space-y-4 animate-in fade-in slide-in-from-top-4 duration-1000">
                <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-[0_0_30px_-5px_rgba(0,132,255,0.5)]">
                    <MessageCircle className="w-8 h-8 text-white" fill="currentColor" />
                </div>
                <div className="text-center space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight text-white">AdNext</h1>
                    <p className="text-sm text-zinc-400">Automação Inteligente para Messenger</p>
                </div>
            </div>

            <Card className="rounded-2xl border-white/5 bg-zinc-950/50 backdrop-blur-xl shadow-2xl relative overflow-hidden group ring-1 ring-white/10">
                <CardContent className="pt-8 px-8 pb-8">
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label htmlFor="email" className="text-xs font-medium text-zinc-400 ml-1">
                                Email
                            </label>
                            <div className="relative group/input">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 transition-colors group-focus-within/input:text-primary" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="seu@adnext.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="bg-black/40 border-white/5 rounded-xl pl-12 h-12 text-sm text-white placeholder:text-zinc-600 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all duration-300"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <label htmlFor="password" className="text-xs font-medium text-zinc-400">
                                    Senha
                                </label>
                                <Link href="#" className="text-xs text-primary hover:text-primary/80 transition-colors">
                                    Esqueceu a senha?
                                </Link>
                            </div>
                            <div className="relative group/input">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 transition-colors group-focus-within/input:text-primary" />
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="bg-black/40 border-white/5 rounded-xl pl-12 h-12 text-sm text-white focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all duration-300"
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full bg-primary text-white hover:bg-primary/90 rounded-xl h-12 font-medium shadow-[0_0_20px_-5px_rgba(0,132,255,0.3)] transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(0,132,255,0.5)]"
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    Acessando...
                                </span>
                            ) : (
                                <span className="flex items-center justify-center gap-2">
                                    Entrar na Plataforma
                                    <ArrowRight className="w-4 h-4" />
                                </span>
                            )}
                        </Button>
                    </form>
                </CardContent>

                <CardFooter className="flex flex-col items-center justify-center pb-8 pt-0">
                    <p className="text-xs text-zinc-500">
                        Não tem uma conta?
                        <Link href="/registrar" className="text-white hover:text-primary ml-1 font-medium transition-colors">
                            Começar agora
                        </Link>
                    </p>
                </CardFooter>
            </Card>

            <p className="text-[10px] text-center text-zinc-700 font-medium">
                © 2026 AdNext Systems.
            </p>
        </div>
    )
}
