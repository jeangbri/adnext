"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load env from root
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../../.env') });
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../../.env.local') });
const bullmq_1 = require("bullmq");
const redis_1 = require("./redis");
const processor_1 = require("./processor");
const worker = new bullmq_1.Worker('instagram-events', async (job) => {
    console.log(`Processing job ${job.id}: ${job.name}`);
    if (job.name === 'processWebhookEvent') {
        await (0, processor_1.processWebhookEvent)(job.data.eventId);
    }
    else if (job.name === 'resumeWorkflow') {
        const { resumeWorkflow } = require('./processor');
        await resumeWorkflow(job.data);
    }
}, {
    connection: redis_1.connection,
    concurrency: 5
});
worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed!`);
});
worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with ${err.message}`);
});
console.log('Worker started for queue: instagram-events');
