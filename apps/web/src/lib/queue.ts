import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const globalForRedis = global as unknown as { redisConnection: IORedis };

const redisUrl = process.env.REDIS_URL;

// Detect Vercel Build environment or missing Redis
// If we are in Vercel and no REDIS_URL is provided (typical during build step unless specifically set), we mock.
const shouldMock = !!process.env.VERCEL && !redisUrl;

let q: Queue;

if (shouldMock) {
    console.warn("⚠️ [Queue] Using Mock Queue (VERCEL env detected + No REDIS_URL).");
    q = {
        add: async (name: string, data: any) => {
            console.log(`[Queue Mock] Added job ${name}`, data);
            return {} as any;
        },
        close: async () => { },
        waitUntilReady: async () => { },
    } as unknown as Queue;
} else {
    // console.log("[Queue] Initializing Real Redis Queue...");

    const url = redisUrl || 'redis://localhost:6379';

    const connection =
        globalForRedis.redisConnection ||
        new IORedis(url, {
            maxRetriesPerRequest: null,
            lazyConnect: true
        });

    if (process.env.NODE_ENV !== 'production') globalForRedis.redisConnection = connection;

    try {
        q = new Queue('messenger-events', {
            connection: connection as any,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000,
                },
                removeOnComplete: true,
                removeOnFail: false
            }
        });
    } catch (e) {
        console.error("Failed to initialize BullMQ queue", e);
        // Fallback to mock to prevent crash?
        q = { add: async () => { } } as any;
    }
}

export const messengerQueue = q;
