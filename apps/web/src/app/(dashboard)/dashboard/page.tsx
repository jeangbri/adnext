import { createClient } from "@/lib/supabase/server";
import { getPrimaryWorkspace } from "@/lib/workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Activity, MessageSquare, ArrowUpRight } from "lucide-react";
import { ServerConfigError } from "@/components/ServerConfigError";
import { getDashboardStats } from "@/lib/dashboard-service";
import { ExecutionsChart } from "./_components/executions-chart";
import { LeadsFunnel } from "./_components/leads-funnel";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import { DashboardFilter } from "./_components/dashboard-filter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: { pageId?: string } }) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return <div>Não autorizado</div>;

        const workspace = await getPrimaryWorkspace(user.id, user.email || '');
        const pageId = searchParams.pageId;
        const stats = await getDashboardStats(workspace.id, pageId);

        return (
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-white">Dashboard</h2>
                        <p className="text-zinc-400">Visão geral da sua operação no Messenger</p>
                    </div>
                    <DashboardFilter />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="bg-zinc-900/50 border-zinc-800">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-zinc-200">
                                Automações Ativas
                            </CardTitle>
                            <Zap className="h-4 w-4 text-[#0084FF]" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">{stats.activeRules}</div>
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
                            <div className="text-2xl font-bold text-white">{stats.totalExecutions}</div>
                            <p className="text-xs text-zinc-500">
                                Desde o início
                            </p>
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
                            <div className="text-2xl font-bold text-white">{stats.messagesSent}</div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
                    <LeadsFunnel stats={stats.leadStats} />
                    <Card className="md:col-span-4 lg:col-span-4 bg-zinc-900/50 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white">Performance Mensagens</CardTitle>
                        </CardHeader>
                        <CardContent className="pl-2">
                            <ExecutionsChart data={stats.chartData} />
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-1">
                    <Card className="bg-zinc-900/50 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white">Atividade Recente</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-8">
                                {stats.recentActivity.length === 0 ? (
                                    <div className="text-sm text-zinc-500 flex items-center justify-center h-[200px] border border-dashed border-zinc-800 rounded-lg bg-black/20">
                                        Nenhuma atividade recente.
                                    </div>
                                ) : (
                                    stats.recentActivity.map((activity) => (
                                        <div key={activity.id} className="flex items-center">
                                            <div className="ml-4 space-y-1">
                                                <p className="text-sm font-medium leading-none text-zinc-200">
                                                    {activity.description}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {formatDistanceToNow(activity.timestamp, { addSuffix: true, locale: ptBR })}
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
            </div >
        )
    } catch (error: any) {
        console.error("Dashboard Error:", error);
        return <ServerConfigError details={{
            message: error?.message || "Erro desconhecido",
            env_engine: process.env.PRISMA_CLIENT_ENGINE_TYPE,
            env_node: process.env.NODE_ENV
        }} />;
    }
}
