
import { prisma } from "@/lib/prisma";

export type DashboardStats = {
    activeRules: number;
    totalExecutions: number;
    messagesSent: number;
    recentActivity: {
        id: string;
        type: 'MESSAGE' | 'EXECUTION';
        description: string;
        timestamp: Date;
        status: string;
    }[];
    chartData: {
        date: string;
        count: number;
    }[];
    leadStats: {
        total: number;
        newToday: number;
        activeNow: number;
        active24h: number;
        active7d: number;
        active30d: number;
    };
};

export async function getDashboardStats(workspaceId: string): Promise<DashboardStats> {
    // 1. Counts
    const activeRules = await prisma.automationRule.count({
        where: {
            workspaceId,
            isActive: true
        }
    });

    const totalExecutions = await prisma.ruleExecution.count({
        where: {
            rule: {
                workspaceId
            }
        }
    });

    const messagesSent = await prisma.messageLog.count({
        where: {
            page: {
                workspaceId
            },
            direction: 'OUT',
            status: 'SENT'
        }
    });

    // 2. Recent Activity (Mix of MessageLogs and RuleExecutions)
    const recentLogs = await prisma.messageLog.findMany({
        where: {
            page: {
                workspaceId
            }
        },
        orderBy: {
            createdAt: 'desc'
        },
        take: 5,
        include: {
            contact: true
        }
    });

    const recentExecutions = await prisma.ruleExecution.findMany({
        where: {
            rule: {
                workspaceId
            }
        },
        orderBy: {
            lastExecutedAt: 'desc'
        },
        take: 5,
        include: {
            rule: true,
            contact: true
        }
    });

    // Merge and sort
    const activity = [
        ...recentLogs.map(log => ({
            id: log.id,
            type: 'MESSAGE' as const,
            description: log.direction === 'IN'
                ? `Mensagem recebida de ${log.contact?.firstName || 'Desconhecido'}`
                : `Resposta enviada para ${log.contact?.firstName || 'Desconhecido'}`,
            timestamp: log.createdAt,
            status: log.status
        })),
        ...recentExecutions.map(exec => ({
            id: exec.id,
            type: 'EXECUTION' as const,
            description: `Regra "${exec.rule.name}" executada para ${exec.contact.firstName || 'Usuario'}`,
            timestamp: exec.lastExecutedAt,
            status: 'SUCCESS'
        }))
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 5);

    // 3. Chart Data (Last 7 days executions)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const executionsLast7Days = await prisma.ruleExecution.findMany({
        where: {
            rule: {
                workspaceId
            },
            lastExecutedAt: {
                gte: sevenDaysAgo
            }
        },
        select: {
            lastExecutedAt: true
        }
    });

    // Group by day
    const chartMap = new Map<string, number>();

    // Initialize last 7 days with 0
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); // DD/MM
        chartMap.set(key, 0);
    }

    executionsLast7Days.forEach(exec => {
        const key = exec.lastExecutedAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (chartMap.has(key)) {
            chartMap.set(key, chartMap.get(key)! + 1);
        }
    });

    // Sort by date (oldest to newest for chart)
    const chartData = Array.from(chartMap.entries())
        .map(([date, count]) => ({ date, count }))
        .reverse();

    // 4. Lead Stats
    const totalLeads = await prisma.contact.count({
        where: { workspaceId }
    });

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const newLeadsToday = await prisma.contact.count({
        where: {
            workspaceId,
            firstSeenAt: { gte: startOfDay }
        }
    });

    // Recency Buckets
    const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgoDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgoDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const activeNow = await prisma.contact.count({ where: { workspaceId, lastSeenAt: { gte: fifteenMinsAgo } } });
    const active24h = await prisma.contact.count({ where: { workspaceId, lastSeenAt: { gte: twentyFourHoursAgo } } });
    const active7d = await prisma.contact.count({ where: { workspaceId, lastSeenAt: { gte: sevenDaysAgoDate } } });
    const active30d = await prisma.contact.count({ where: { workspaceId, lastSeenAt: { gte: thirtyDaysAgoDate } } });

    return {
        activeRules,
        totalExecutions,
        messagesSent,
        recentActivity: activity,
        chartData,
        leadStats: {
            total: totalLeads,
            newToday: newLeadsToday,
            activeNow,
            active24h,
            active7d,
            active30d
        }
    };
}
