"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
    Home,
    Zap,
    MessageSquare,
    Inbox,
    MessageCircle,
    Trophy,
    Users,
    Compass,
    LayoutTemplate,
    HelpCircle,
    LogOut,
    Settings
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

const sidebarItems = [
    {
        title: "Principal",
        items: [
            { label: "Dashboard", href: "/dashboard", icon: Home },
        ]
    },
    {
        title: "Automação",
        items: [
            { label: "Regras", href: "/workflows", icon: Zap },
            { label: "Logs", href: "/logs", icon: MessageSquare },
        ]
    },
    {
        title: "Sistema",
        items: [
            { label: "Integrações", href: "/settings/integracoes", icon: Settings },
            // { label: "Configurações", href: "/settings/geral", icon: Settings }, // If needed
        ]
    }
]

export function Sidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/entrar')
        router.refresh()
    }

    return (
        <div className="flex h-screen w-64 flex-col border-r bg-card text-card-foreground">
            <div className="p-6">
                <Link href="/dashboard" className="flex items-center gap-2 group">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 shadow-[0_0_15px_-3px_rgba(0,132,255,0.4)]">
                        <MessageCircle className="w-5 h-5 text-white" fill="currentColor" />
                    </div>
                    <span className="font-bold text-xl tracking-tight text-white">AdNext</span>
                </Link>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2">
                {sidebarItems.map((group, i) => (
                    <div key={i} className="mb-6">
                        <h3 className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {group.title}
                        </h3>
                        <div className="space-y-1">
                            {group.items.map((item) => {
                                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-zinc-900 group",
                                            isActive
                                                ? "bg-primary/10 text-primary"
                                                : "text-zinc-500 hover:text-zinc-300"
                                        )}
                                    >
                                        <item.icon className={cn("h-4 w-4 transition-colors", isActive ? "text-primary" : "text-zinc-500 group-hover:text-zinc-300")} />
                                        {item.label}
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                ))}

                {/* Settings explicit link */}
                <div className="mb-6">
                    <h3 className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Configurações
                    </h3>
                    <div className="space-y-1">
                        <Link
                            href="/settings/integracoes"
                            className={cn(
                                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-zinc-900 group",
                                pathname.startsWith('/settings')
                                    ? "bg-primary/10 text-primary"
                                    : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            <Settings className={cn("h-4 w-4 transition-colors", pathname.startsWith('/settings') ? "text-primary" : "text-zinc-500 group-hover:text-zinc-300")} />
                            Integrações
                        </Link>
                    </div>
                </div>
            </div>

            <div className="border-t p-4">
                <div className="mb-4 flex items-center gap-3 rounded-md border bg-background p-3">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <p className="truncate text-xs font-medium">Meu Perfil</p>
                        <p className="truncate text-xs text-muted-foreground">Configurações</p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
                    onClick={handleLogout}
                >
                    <LogOut className="h-4 w-4" />
                    Sair
                </Button>
            </div>
        </div>
    )
}
