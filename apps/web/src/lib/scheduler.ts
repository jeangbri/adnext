import { prisma } from './prisma';

export interface ExecutionContext {
    executionId: string;
    pageId: string;
    psid: string;
    ruleId: string;
    nextIndex: number;
    createdAt: number;
    runAt: number;
    replyToCommentId?: string;
    refLogId?: string;
}

/**
 * Save a scheduled execution to the database.
 * Replaces Redis ZSET + QStash with simple Prisma insert.
 */
export async function saveAndScheduleExecution(ctx: ExecutionContext, delayMs: number) {
    const runAt = new Date(Date.now() + delayMs);

    // Upsert: if same executionId exists (re-schedule), update it
    await prisma.scheduledExecution.upsert({
        where: { id: ctx.executionId },
        create: {
            id: ctx.executionId,
            pageId: ctx.pageId,
            psid: ctx.psid,
            ruleId: ctx.ruleId,
            nextIndex: ctx.nextIndex,
            runAt,
            status: 'PENDING',
            refLogId: ctx.refLogId,
            replyToCommentId: ctx.replyToCommentId,
        },
        update: {
            nextIndex: ctx.nextIndex,
            runAt,
            status: 'PENDING',
            refLogId: ctx.refLogId,
            replyToCommentId: ctx.replyToCommentId,
            attempts: 0,
            lastError: null,
        },
    });

    console.log(`[Scheduler] Saved execution ${ctx.executionId} to run at ${runAt.toISOString()} (delay: ${delayMs}ms)`);
}

/**
 * Get execution state from the database.
 */
export async function getExecutionState(executionId: string): Promise<ExecutionContext | null> {
    const exec = await prisma.scheduledExecution.findUnique({
        where: { id: executionId },
    });

    if (!exec) return null;

    return {
        executionId: exec.id,
        pageId: exec.pageId,
        psid: exec.psid,
        ruleId: exec.ruleId,
        nextIndex: exec.nextIndex,
        createdAt: exec.createdAt.getTime(),
        runAt: exec.runAt.getTime(),
        refLogId: exec.refLogId || undefined,
        replyToCommentId: exec.replyToCommentId || undefined,
    };
}

/**
 * Mark execution as done and remove from queue.
 */
export async function clearExecution(executionId: string) {
    try {
        await prisma.scheduledExecution.update({
            where: { id: executionId },
            data: { status: 'DONE' },
        });
    } catch (e) {
        // If not found, ignore (already cleared)
        console.warn(`[Scheduler] clearExecution: ${executionId} not found or already cleared`);
    }
}

/**
 * Get due executions from the database (status=PENDING, runAt <= now).
 */
export async function getDueExecutions(limit = 50): Promise<string[]> {
    const now = new Date();

    const executions = await prisma.scheduledExecution.findMany({
        where: {
            status: 'PENDING',
            runAt: { lte: now },
            attempts: { lt: 5 }, // Max 5 retries
        },
        orderBy: { runAt: 'asc' },
        take: limit,
        select: { id: true },
    });

    return executions.map(e => e.id);
}

/**
 * Mark execution as processing (prevents double-processing).
 */
export async function markProcessing(executionId: string): Promise<boolean> {
    try {
        const result = await prisma.scheduledExecution.updateMany({
            where: {
                id: executionId,
                status: 'PENDING', // Only grab if still PENDING (optimistic lock)
            },
            data: {
                status: 'PROCESSING',
                attempts: { increment: 1 },
            },
        });
        return result.count > 0;
    } catch {
        return false;
    }
}

/**
 * Mark execution as failed (will be retried on next sweep).
 */
export async function markFailed(executionId: string, error: string) {
    try {
        await prisma.scheduledExecution.update({
            where: { id: executionId },
            data: {
                status: 'PENDING', // Reset to PENDING for retry
                lastError: error,
            },
        });
    } catch {
        // ignore
    }
}
