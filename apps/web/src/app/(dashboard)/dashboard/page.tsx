import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getPrimaryWorkspace } from "@/lib/workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Activity, MessageSquare } from "lucide-react";
import { ServerConfigError } from "@/components/ServerConfigError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return <div>Não autorizado</div>;

        const workspace = await getPrimaryWorkspace(user.id, user.email || '');

        // Stats
        const workflowsCount = await prisma.workflow.count({
            where: { workspaceId: workspace.id, isActive: true }
        });

        const runsCount = await prisma.automationRun.count({
            where: {
                workflow: { workspaceId: workspace.id }
            }
        });

        return (
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-white">Dashboard</h2>
                        <p className="text-zinc-400">Visão geral da sua operação no Messenger</p>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="bg-zinc-900/50 border-zinc-800">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-zinc-200">
                                Automações Ativas
                            </CardTitle>
                            <Zap className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">{workflowsCount}</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-zinc-900/50 border-zinc-800">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-zinc-200">
                                Execuções Totais
                            </CardTitle>
                            <Activity className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">{runsCount}</div>
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
                            <MessageSquare className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">{runsCount}</div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <Card className="col-span-4 bg-zinc-900/50 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white">Performance</CardTitle>
                        </CardHeader>
                        <CardContent className="pl-2">
                            <div className="h-[200px] flex items-center justify-center text-zinc-500 border border-dashed border-zinc-800 rounded-lg bg-black/20">
                                Gráfico de execuções (Em breve)
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="col-span-3 bg-zinc-900/50 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white">Atividade Recente</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm text-zinc-500 flex items-center justify-center h-[200px] border border-dashed border-zinc-800 rounded-lg bg-black/20">
                                Nenhuma atividade recente.
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
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
