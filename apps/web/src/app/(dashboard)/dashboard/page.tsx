"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Zap, Activity, MessageSquare } from "lucide-react"
import { ExecutionsChart } from "./_components/executions-chart"
import { LeadsFunnel } from "./_components/leads-funnel"
import { DashboardFilter } from "./_components/dashboard-filter"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"

type DashboardStats = {
    activeRules: number
    totalExecutions: number
    messagesSent: number
    recentActivity: {
        id: string
        type: 'MESSAGE' | 'EXECUTION'
        description: string
        timestamp: string
        status: string
    }[]
    chartData: { date: string; count: number }[]
    leadStats: {
        total: number
        newToday: number
        activeNow: number
        active24h: number
        active7d: number
        active30d: number
    }
    broadcastStats: {
        totalCampaigns: number
        totalSent: number
    }
}

function StatCardSkeleton() {
    return (
        <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-32 bg-zinc-800" />
                <Skeleton className="h-4 w-4 rounded bg-zinc-800" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-8 w-16 bg-zinc-800" />
            </CardContent>
        </Card>
    )
}

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch('/api/dashboard/stats')
            if (res.ok) {
                const data = await res.json()
                setStats(data)
            }
        } catch (e) {
            console.error("Dashboard fetch error:", e)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchStats()
    }, [fetchStats])

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white">Dashboard</h2>
                    <p className="text-zinc-400">Visão geral da sua operação no Messenger</p>
                </div>
                <DashboardFilter />
            </div>

            {/* Stats Cards - show skeleton or data */}
            <div className="grid gap-4 md:grid-cols-3">
                {loading ? (
                    <>
                        <StatCardSkeleton />
                        <StatCardSkeleton />
                        <StatCardSkeleton />
                    </>
                ) : (
                    <>
                        <Card className="bg-zinc-900/50 border-zinc-800">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-zinc-200">
                                    Automações Ativas
                                </CardTitle>
                                <Zap className="h-4 w-4 text-[#0084FF]" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-white">{stats?.activeRules ?? 0}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-zinc-900/50 border-zinc-800">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-zinc-200">
                                    Execuções Totais
                                </CardTitle>
                                <Activity className="h-4 w-4 text-[#0084FF]" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-white">{stats?.totalExecutions ?? 0}</div>
                                <p className="text-xs text-zinc-500">Desde o início</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-zinc-900/50 border-zinc-800">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-zinc-200">
                                    Respostas Enviadas
                                </CardTitle>
                                <MessageSquare className="h-4 w-4 text-[#0084FF]" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-white">{stats?.messagesSent ?? 0}</div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>

            {/* Charts */}
            <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
                {loading ? (
                    <>
                        <Card className="md:col-span-4 lg:col-span-4 bg-zinc-900/50 border-zinc-800">
                            <CardHeader><Skeleton className="h-6 w-32 bg-zinc-800" /></CardHeader>
                            <CardContent><Skeleton className="h-[200px] w-full bg-zinc-800/40 rounded" /></CardContent>
                        </Card>
                        <Card className="md:col-span-4 lg:col-span-4 bg-zinc-900/50 border-zinc-800">
                            <CardHeader><Skeleton className="h-6 w-40 bg-zinc-800" /></CardHeader>
                            <CardContent><Skeleton className="h-[200px] w-full bg-zinc-800/40 rounded" /></CardContent>
                        </Card>
                    </>
                ) : stats ? (
                    <>
                        <LeadsFunnel stats={stats.leadStats} />
                        <Card className="md:col-span-4 lg:col-span-4 bg-zinc-900/50 border-zinc-800">
                            <CardHeader>
                                <CardTitle className="text-white">Performance Mensagens</CardTitle>
                            </CardHeader>
                            <CardContent className="pl-2">
                                <ExecutionsChart data={stats.chartData} />
                            </CardContent>
                        </Card>
                    </>
                ) : null}
            </div>

            {/* Recent Activity */}
            <div className="grid gap-4 md:grid-cols-1">
                <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-white">Atividade Recente</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            {loading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="flex items-center gap-4">
                                        <div className="ml-4 space-y-1.5 flex-1">
                                            <Skeleton className="h-4 w-48 bg-zinc-800" />
                                            <Skeleton className="h-3 w-24 bg-zinc-800/60" />
                                        </div>
                                        <Skeleton className="h-4 w-20 bg-zinc-800" />
                                    </div>
                                ))
                            ) : stats?.recentActivity.length === 0 ? (
                                <div className="text-sm text-zinc-500 flex items-center justify-center h-[200px] border border-dashed border-zinc-800 rounded-lg bg-black/20">
                                    Nenhuma atividade recente.
                                </div>
                            ) : (
                                stats?.recentActivity.map((activity) => (
                                    <div key={activity.id} className="flex items-center">
                                        <div className="ml-4 space-y-1">
                                            <p className="text-sm font-medium leading-none text-zinc-200">
                                                {activity.description}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true, locale: ptBR })}
                                            </p>
                                        </div>
                                        <div className="ml-auto font-medium text-sm text-zinc-400">
                                            {activity.type === 'MESSAGE' ? 'Mensagem' : 'Execução'}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
