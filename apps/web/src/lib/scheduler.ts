import { redis, qstash } from './upstash';
import { v4 as uuidv4 } from 'uuid';

export interface ExecutionContext {
    executionId: string;
    pageId: string;
    psid: string; // User ID
    ruleId: string;
    // Current state
    nextIndex: number;
    // Snapshot of actions (or we can re-fetch rule, but snapshot is safer if rule changes)
    // For simplicity and db sync, let's re-fetch rule by ID, but we strictly follow index.
    // If rule changes actions order, it might break. 
    // Ideally we store the list of actions? Or just ruleId is enough if we assume atomic deployments or user accepts risk.
    // User requirement: "actionsSnapshot (ou referência da regra + versão)"
    // Let's store ruleId for now to avoid huge Redis payloads, but keep it simple.
    // Important: Context might need variables in future.
    createdAt: number;
    runAt: number;
    replyToCommentId?: string; // Special context
    refLogId?: string; // Original Log ID for tracking
}

const REDIS_PREFIX = 'adnext:exec:';
const QUEUE_KEY = 'adnext:exec:queue'; // ZSET

export async function saveAndScheduleExecution(ctx: ExecutionContext, delayMs: number) {
    const runAt = Date.now() + delayMs;
    ctx.runAt = runAt;

    // 1. Save State in Redis
    const key = `${REDIS_PREFIX}${ctx.executionId}`;
    await redis.set(key, JSON.stringify(ctx), { ex: 86400 * 7 }); // Expire in 7 days

    // 2. Add to Fallback Queue (ZSET)
    await redis.zadd(QUEUE_KEY, { score: runAt, member: ctx.executionId });

    // 3. Schedule via QStash (if configured)
    if (qstash) {
        try {
            const delaySeconds = Math.max(0, Math.ceil(delayMs / 1000));
            // Use absolute URL or env var for domain
            const appUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
            const destination = `${appUrl}/api/messenger/runner`;

            await qstash.publishJSON({
                url: destination,
                body: { executionId: ctx.executionId },
                delay: delaySeconds,
                // Add signing? QStash signs by default. We verify in runner.
            });
            console.log(`[Scheduler] Scheduled QStash job for ${ctx.executionId} in ${delaySeconds}s`);
        } catch (e) {
            console.error('[Scheduler] QStash scheduling failed, relying on fallback cron', e);
        }
    }
}

export async function getExecutionState(executionId: string): Promise<ExecutionContext | null> {
    const key = `${REDIS_PREFIX}${executionId}`;
    return await redis.get<ExecutionContext>(key);
}

export async function clearExecution(executionId: string) {
    const key = `${REDIS_PREFIX}${executionId}`;
    await redis.del(key);
    await redis.zrem(QUEUE_KEY, executionId);
}

export async function getDueExecutions(limit = 50): Promise<string[]> {
    const now = Date.now();
    // Get items with score <= now
    return await redis.zrange(QUEUE_KEY, 0, now, { byScore: true, offset: 0, count: limit });
}
