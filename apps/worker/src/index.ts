import dotenv from 'dotenv';
import path from 'path';

// Load env from root
dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

import { Worker } from 'bullmq';
import { connection } from './redis';
import { processWebhookEvent } from './processor';

const worker = new Worker('instagram-events', async (job) => {
    console.log(`Processing job ${job.id}: ${job.name}`);

    if (job.name === 'processWebhookEvent') {
        await processWebhookEvent(job.data.eventId);
    } else if (job.name === 'resumeWorkflow') {
        const { resumeWorkflow } = require('./processor');
        await resumeWorkflow(job.data);
    }
}, {
    connection: connection as any,
    concurrency: 5
});

worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed!`);
});

worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with ${err.message}`);
});

console.log('Worker started for queue: instagram-events');
