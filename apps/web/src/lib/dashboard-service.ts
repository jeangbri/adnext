
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
    broadcastStats: {
        totalCampaigns: number;
        totalSent: number;
    };
};

export async function getDashboardStats(workspaceId: string, pageId?: string, pageIds?: string[]): Promise<DashboardStats> {
    const pageFilter = pageId
        ? { pageId }
        : (pageIds && pageIds.length > 0 ? { pageId: { in: pageIds } } : {});

    const directPageFilter = pageId
        ? { pageId }
        : (pageIds && pageIds.length > 0 ? { pageId: { in: pageIds } } : {});

    const rulePageFilter = pageId
        ? { OR: [{ pageIds: { has: pageId } }, { pageIds: { equals: [] } }] }
        : (pageIds && pageIds.length > 0 ? { OR: [{ pageIds: { hasSome: pageIds } }, { pageIds: { equals: [] } }] } : {});

    // Pre-calculate all date boundaries
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Run ALL queries in parallel
    const [
        activeRules,
        totalExecutions,
        messagesSent,
        recentLogs,
        recentExecutions,
        sentMessagesLast7Days,
        totalLeads,
        newLeadsToday,
        activeNow,
        active24h,
        active7d,
        active30d,
        totalCampaigns,
        broadcastSentCount
    ] = await Promise.all([
        // 1. Active rules count
        prisma.automationRule.count({
            where: { workspaceId, isActive: true, ...rulePageFilter }
        }),

        // 2. Total executions count
        prisma.ruleExecution.count({
            where: { rule: { workspaceId }, ...directPageFilter }
        }),

        // 3. Messages sent count
        prisma.messageLog.count({
            where: { page: { workspaceId }, direction: 'OUT', status: 'SENT', ...pageFilter }
        }),

        // 4. Recent message logs
        prisma.messageLog.findMany({
            where: { page: { workspaceId }, ...pageFilter },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { contact: true }
        }),

        // 5. Recent executions
        prisma.ruleExecution.findMany({
            where: { rule: { workspaceId }, ...directPageFilter },
            orderBy: { lastExecutedAt: 'desc' },
            take: 5,
            include: { rule: true, contact: true }
        }),

        // 6. Chart data (sent messages last 7 days)
        prisma.messageLog.findMany({
            where: {
                page: { workspaceId },
                direction: 'OUT',
                status: 'SENT',
                ...pageFilter,
                createdAt: { gte: sevenDaysAgo }
            },
            select: { createdAt: true }
        }),

        // 7. Total leads
        prisma.contact.count({
            where: { workspaceId, ...directPageFilter }
        }),

        // 8. New leads today
        prisma.contact.count({
            where: { workspaceId, firstSeenAt: { gte: startOfDay }, ...directPageFilter }
        }),

        // 9. Active now (15 min)
        prisma.contact.count({
            where: { workspaceId, lastSeenAt: { gte: fifteenMinsAgo }, ...directPageFilter }
        }),

        // 10. Active 24h
        prisma.contact.count({
            where: { workspaceId, lastSeenAt: { gte: twentyFourHoursAgo }, ...directPageFilter }
        }),

        // 11. Active 7d
        prisma.contact.count({
            where: { workspaceId, lastSeenAt: { gte: sevenDaysAgo }, ...directPageFilter }
        }),

        // 12. Active 30d
        prisma.contact.count({
            where: { workspaceId, lastSeenAt: { gte: thirtyDaysAgo }, ...directPageFilter }
        }),

        // 13. Total campaigns
        prisma.broadcastCampaign.count({
            where: { workspaceId, ...directPageFilter }
        }),

        // 14. Broadcast sent count
        prisma.broadcastRecipient.count({
            where: { workspaceId, status: 'SENT', ...directPageFilter }
        })
    ]);

    // Process recent activity (merge+sort)
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

    // Process chart data
    const chartMap = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        chartMap.set(key, 0);
    }

    sentMessagesLast7Days.forEach(msg => {
        const key = msg.createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (chartMap.has(key)) chartMap.set(key, chartMap.get(key)! + 1);
    });

    const chartData = Array.from(chartMap.entries())
        .map(([date, count]) => ({ date, count }))
        .reverse();

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
        },
        broadcastStats: {
            totalCampaigns,
            totalSent: broadcastSentCount
        }
    };
}
