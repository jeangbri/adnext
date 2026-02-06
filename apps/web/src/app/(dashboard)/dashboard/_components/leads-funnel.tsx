import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, CalendarDays, Activity } from "lucide-react";

type LeadStats = {
    total: number;
    newToday: number;
    activeNow: number;
    active24h: number;
    active7d: number;
    active30d: number;
};

export function LeadsFunnel({ stats }: { stats: LeadStats }) {
    return (
        <Card className="col-span-full md:col-span-4 lg:col-span-4 bg-zinc-900/50 border-zinc-800">
            <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                    <span>Funil de Leads</span>
                    <Users className="w-4 h-4 text-[#0084FF]" />
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div className="bg-black/20 p-4 rounded-lg border border-zinc-800/50">
                        <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1 flex items-center gap-2">
                            <Users className="w-3 h-3" /> Total
                        </div>
                        <div className="text-2xl font-bold text-white">{stats.total}</div>
                    </div>
                    <div className="bg-black/20 p-4 rounded-lg border border-zinc-800/50">
                        <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1 flex items-center gap-2">
                            <Clock className="w-3 h-3" /> Hoje (Novos)
                        </div>
                        <div className="text-2xl font-bold text-green-400">+{stats.newToday}</div>
                    </div>
                    <div className="bg-black/20 p-4 rounded-lg border border-zinc-800/50">
                        <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1 flex items-center gap-2">
                            <Activity className="w-3 h-3" /> Ativos (24h)
                        </div>
                        <div className="text-2xl font-bold text-blue-400">{stats.active24h}</div>
                    </div>
                    <div className="bg-black/20 p-4 rounded-lg border border-zinc-800/50">
                        <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1 flex items-center gap-2">
                            <CalendarDays className="w-3 h-3" /> Ativos (7d)
                        </div>
                        <div className="text-2xl font-bold text-purple-400">{stats.active7d}</div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h4 className="text-xs font-semibold uppercase text-zinc-500 tracking-wider">Engajamento por Recência</h4>

                    <div className="space-y-3">
                        {/* Active Now */}
                        <div className="flex items-center justify-between p-3 rounded bg-zinc-800/30 border border-zinc-800/50">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-sm text-zinc-300">Online Agora (15 min)</span>
                            </div>
                            <span className="font-mono text-white font-bold">{stats.activeNow}</span>
                        </div>

                        {/* Active 24h */}
                        <div className="flex items-center justify-between p-3 rounded bg-zinc-800/30 border border-zinc-800/50">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                <span className="text-sm text-zinc-300">Últimas 24 horas</span>
                            </div>
                            <span className="font-mono text-white font-bold">{stats.active24h}</span>
                        </div>

                        {/* Active 7 days */}
                        <div className="flex items-center justify-between p-3 rounded bg-zinc-800/30 border border-zinc-800/50">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-purple-400" />
                                <span className="text-sm text-zinc-300">Última Semana</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="h-1.5 w-24 bg-zinc-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-purple-400/50"
                                        style={{ width: `${stats.total > 0 ? (stats.active7d / stats.total) * 100 : 0}%` }}
                                    />
                                </div>
                                <span className="font-mono text-white font-bold">{stats.active7d}</span>
                            </div>
                        </div>

                        {/* Active 30 days */}
                        <div className="flex items-center justify-between p-3 rounded bg-zinc-800/30 border border-zinc-800/50">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-zinc-500" />
                                <span className="text-sm text-zinc-300">Último Mês</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="h-1.5 w-24 bg-zinc-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-zinc-500/50"
                                        style={{ width: `${stats.total > 0 ? (stats.active30d / stats.total) * 100 : 0}%` }}
                                    />
                                </div>
                                <span className="font-mono text-white font-bold">{stats.active30d}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
