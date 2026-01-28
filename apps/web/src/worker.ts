import fs from 'fs';
import path from 'path';
import { Worker } from 'bullmq';

// Manually load .env to avoid dependencies
try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf-8');
        envConfig.split('\n').forEach(line => {
            const [key, ...values] = line.split('=');
            if (key && values.length > 0 && !process.env[key.trim()]) {
                let value = values.join('=').trim();
                // Remove quotes
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                process.env[key.trim()] = value;
            }
        });
        console.log('[Worker] Loaded .env file');
    }
} catch (e) {
    console.warn('[Worker] Failed to load .env file manually', e);
}
import { resumeWorkflowFromJob } from './lib/messenger-service';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
});

console.log(`[Worker] Starting... Connecting to ${redisUrl}`);

const worker = new Worker('instagram-events', async (job) => {
    console.log(`[Worker] Processing job ${job.name} (${job.id})`);
    if (job.name === 'resumeWorkflow') {
        try {
            await resumeWorkflowFromJob(job.data);
            console.log(`[Worker] Job ${job.id} done.`);
        } catch (error) {
            console.error(`[Worker] Job ${job.id} failed:`, error);
            throw error;
        }
    }
}, {
    connection: connection as any,
    concurrency: 5
});

worker.on('ready', () => {
    console.log('[Worker] Ready and waiting for jobs...');
});

worker.on('error', (err) => {
    console.error('[Worker] Error:', err);
});
