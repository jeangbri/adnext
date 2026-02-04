
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

export async function getDashboardStats(workspaceId: string, pageId?: string): Promise<DashboardStats> {
    // Helper filter for Page ID
    const pageFilter = pageId ? { pageId } : {};

    // NEW: Direct column filters (much faster)
    const directPageFilter = pageId ? { pageId } : {};

    const rulePageFilter = pageId
        ? { OR: [{ pageIds: { has: pageId } }, { pageIds: { equals: [] } }] }
        : {};

    // 1. Counts
    const activeRules = await prisma.automationRule.count({
        where: {
            workspaceId,
            isActive: true,
            ...rulePageFilter
        }
    });

    const totalExecutions = await prisma.ruleExecution.count({
        where: {
            rule: { workspaceId },
            ...directPageFilter
        }
    });

    const messagesSent = await prisma.messageLog.count({
        where: {
            page: { workspaceId },
            direction: 'OUT',
            status: 'SENT',
            ...pageFilter
        }
    });

    // 2. Recent Activity
    const recentLogs = await prisma.messageLog.findMany({
        where: {
            page: { workspaceId },
            ...pageFilter
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { contact: true }
    });

    const recentExecutions = await prisma.ruleExecution.findMany({
        where: {
            rule: { workspaceId },
            ...directPageFilter
        },
        orderBy: { lastExecutedAt: 'desc' },
        take: 5,
        include: { rule: true, contact: true }
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

    // 3. Chart Data (Total Sent Messages: Automation + Broadcast)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const sentMessagesLast7Days = await prisma.messageLog.findMany({
        where: {
            page: { workspaceId },
            direction: 'OUT',
            status: 'SENT',
            ...pageFilter,
            createdAt: { gte: sevenDaysAgo }
        },
        select: { createdAt: true }
    });

    // Group by day
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

    // 4. Lead Stats
    const totalLeads = await prisma.contact.count({
        where: {
            workspaceId,
            ...directPageFilter
        }
    });

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const newLeadsToday = await prisma.contact.count({
        where: {
            workspaceId,
            firstSeenAt: { gte: startOfDay },
            ...directPageFilter
        }
    });

    // Recency Buckets
    const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgoDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgoDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const activeNow = await prisma.contact.count({ where: { workspaceId, lastSeenAt: { gte: fifteenMinsAgo }, ...directPageFilter } });
    const active24h = await prisma.contact.count({ where: { workspaceId, lastSeenAt: { gte: twentyFourHoursAgo }, ...directPageFilter } });
    const active7d = await prisma.contact.count({ where: { workspaceId, lastSeenAt: { gte: sevenDaysAgoDate }, ...directPageFilter } });
    const active30d = await prisma.contact.count({ where: { workspaceId, lastSeenAt: { gte: thirtyDaysAgoDate }, ...directPageFilter } });

    // 5. Broadcast Stats
    const totalCampaigns = await prisma.broadcastCampaign.count({
        where: { workspaceId, ...directPageFilter }
    });

    // Sent via broadcast
    const broadcastSentCount = await prisma.broadcastRecipient.count({
        where: {
            workspaceId,
            status: 'SENT',
            ...directPageFilter
        }
    });

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
