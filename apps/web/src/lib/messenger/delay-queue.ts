
import { Redis } from '@upstash/redis';

// Use env vars or defaults (checking process.env for client-side safety if needed, but this is server-side lib)
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

export interface DelayJob {
    executionId: string; // Unique ID for the job instance (could be UUID)
    pageId: string;
    userId: string; // PSID
    ruleId: string;
    stepIndex: number;
    wakeUpAt: number;
    context?: any; // Extra data like refLogId
    replyToCommentId?: string;
}

const QUEUE_KEY = 'messenger:delay_queue';

export const delayQueue = {
    /**
     * Enqueue a job to be processed at a specific timestamp.
     */
    async enqueue(job: DelayJob) {
        // Score is the timestamp (wakeUpAt)
        // Member is the job JSON string (or ID if we store payload elsewhere, but JSON string is simpler for small payloads)
        // To ensure uniqueness and update capability, we might want to use a hash + zset? 
        // Simplest: ZSET with JSON string. But removing by ID is hard.
        // Better: Store job details in a HASH (key: executionId), and executionId in ZSET (score: wakeUpAt).

        // 1. Store Job Data
        await redis.hset(`messenger:jobs:${job.executionId}`, job as any);

        // 2. Schedule in ZSET
        await redis.zadd(QUEUE_KEY, { score: job.wakeUpAt, member: job.executionId });

        console.log(`[DelayQueue] Enqueued job ${job.executionId} for ${new Date(job.wakeUpAt).toISOString()}`);
    },

    /**
     * Fetch jobs that are ready to run (score <= now).
     */
    async getDueJobs(limit = 50): Promise<DelayJob[]> {
        const now = Date.now();

        // 1. Get IDs from ZSET
        const jobIds = await redis.zrange(QUEUE_KEY, 0, now, { byScore: true, offset: 0, count: limit });

        if (jobIds.length === 0) return [];

        // 2. Fetch Job Data (Parallel)
        // We use a pipeline for efficiency if possible, or just Promise.all
        // Redis http client supports pipeline? Yes.
        const pipeline = redis.pipeline();
        jobIds.forEach((id) => pipeline.hgetall(`messenger:jobs:${id}`));
        const results = await pipeline.exec();

        // Filter out nulls (if job data vanished)
        const jobs = results.map(r => r as DelayJob).filter(j => j && j.executionId);

        return jobs as DelayJob[];
    },

    /**
     * Remove jobs from the queue (after they are picked up).
     * Usually done atomically with fetch if using Lua, but for now we separate.
     * "getDueJobs" only PEEKS. "ack" removes.
     */
    async ack(executionIds: string[]) {
        if (executionIds.length === 0) return;

        const pipeline = redis.pipeline();
        // Remove from ZSET
        pipeline.zrem(QUEUE_KEY, ...executionIds);
        // Remove Data
        executionIds.forEach(id => pipeline.del(`messenger:jobs:${id}`));

        await pipeline.exec();
    },

    /**
     * Remove a specific job (e.g., if user cancels or flows jump).
     */
    async remove(executionId: string) {
        await redis.zrem(QUEUE_KEY, executionId);
        await redis.del(`messenger:jobs:${executionId}`);
    }
};
