"use client"

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Lock, Mail, ArrowRight, UserPlus } from 'lucide-react'

export default function RegisterPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            })

            if (error) {
                toast.error('Erro ao registrar: ' + error.message)
            } else {
                toast.success('Conta criada! Verifique seu email ou faça login.')
                router.push('/entrar')
            }
        } catch (err) {
            toast.error('Ocorreu um erro inesperado')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-10">
            {/* Logo Section */}
            <div className="flex flex-col items-center justify-center animate-in fade-in slide-in-from-top-4 duration-1000">
                <img
                    src="https://i.imgur.com/tndREaM.png"
                    alt="Creatye Logo"
                    className="w-48 h-auto object-contain drop-shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                />
            </div>

            <Card className="rounded-xl border-white/10 bg-white/5 backdrop-blur-2xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden group">
                {/* Accent Top Bar */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500 opacity-20" />

                <CardHeader className="space-y-2 text-center pt-8">
                    <CardTitle className="text-2xl font-light tracking-tight text-white">
                        Comece com o <span className="font-bold">Creatye</span>
                    </CardTitle>
                    <CardDescription className="text-slate-400 text-xs uppercase tracking-[0.3em] font-semibold">
                        Crie sua conta de automação
                    </CardDescription>
                </CardHeader>

                <CardContent className="pt-6 px-10 pb-10">
                    <form onSubmit={handleRegister} className="space-y-6">
                        <div className="space-y-2.5 group/input">
                            <label htmlFor="email" className="text-[11px] uppercase tracking-widest text-slate-400 font-bold ml-1 transition-colors group-focus-within/input:text-cyan-400">
                                Email Profissional
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500 transition-colors group-focus-within/input:text-cyan-400" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="seu@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="bg-slate-950/50 border-white/10 rounded-lg pl-12 h-12 text-base text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-0 focus:bg-slate-950/80 transition-all duration-300"
                                />
                            </div>
                        </div>

                        <div className="space-y-2.5 group/input">
                            <label htmlFor="password" className="text-[11px] uppercase tracking-widest text-slate-400 font-bold ml-1 transition-colors group-focus-within/input:text-cyan-400">
                                Senha de Acesso
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500 transition-colors group-focus-within/input:text-cyan-400" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="bg-slate-950/50 border-white/10 rounded-lg pl-12 h-12 text-base text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-0 focus:bg-slate-950/80 transition-all duration-300"
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full bg-white text-slate-950 hover:bg-cyan-500 hover:text-white rounded-lg h-12 transition-all duration-300 group font-bold text-sm uppercase tracking-widest shadow-lg shadow-white/5"
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="flex items-center gap-3">
                                    <div className="w-4 h-4 border-2 border-slate-950/20 border-t-slate-950 rounded-full animate-spin" />
                                    Criando...
                                </span>
                            ) : (
                                <span className="flex items-center justify-center gap-2">
                                    Criar Minha Conta
                                    <UserPlus className="w-4 h-4 transition-transform group-hover:scale-110" />
                                </span>
                            )}
                        </Button>
                    </form>
                </CardContent>

                <CardFooter className="flex flex-col items-center justify-center pb-10 pt-0 space-y-6">
                    <div className="w-full px-10">
                        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    </div>
                    <p className="text-[11px] text-slate-500 tracking-wide font-medium">
                        Já possui uma conta?
                        <Link href="/entrar" className="text-white hover:text-cyan-400 ml-2 transition-colors font-bold uppercase tracking-widest border-b border-white/10 pb-0.5">
                            Fazer Login
                        </Link>
                    </p>
                </CardFooter>
            </Card>

            <p className="text-[10px] text-center text-slate-600 uppercase tracking-[0.5em] font-bold opacity-60">
                © 2026 Creatye. Precision Software.
            </p>
        </div>
    )
}
