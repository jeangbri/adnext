"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("@repo/db");
// Queue is defined in web/lib/queue.ts. 
// Worker should have its own queue definition pointing to same Redis.
// In worker/src/index.ts we have `new Worker`.
// To add jobs, we need `new Queue`.
const bullmq_1 = require("bullmq");
const redis_1 = require("./redis");
const prisma = new db_1.PrismaClient();
const queue = new bullmq_1.Queue('instagram-events', { connection: redis_1.connection });
async function main() {
    console.log("=== SMOKE TEST: WEBHOOK PROCESSING ===\n");
    // 1. Create Mock Webhook Event
    const payload = {
        object: "instagram",
        entry: [
            {
                id: "17841400000000000", // Fake Business ID. Ensure you have an Account in DB with this ID for End-to-End
                time: Date.now(),
                messaging: [
                    {
                        sender: { id: "12345678" },
                        recipient: { id: "17841400000000000" },
                        timestamp: Date.now(),
                        message: {
                            mid: "m_123",
                            text: "teste automacao" // Keyword 'teste'
                        }
                    }
                ]
            }
        ]
    };
    // Create Event in DB manually (Simulate Receiver)
    const event = await prisma.webhookEvent.create({
        data: {
            platform: 'INSTAGRAM',
            eventType: 'instagram',
            platformEventId: 'test_evt_' + Date.now(),
            payloadJson: payload,
            signatureValid: true,
            processingStatus: 'PENDING'
        }
    });
    console.log(`[1] Created WebhookEvent: ${event.id}`);
    // 2. Enqueue Job
    await queue.add('processWebhookEvent', { eventId: event.id });
    console.log(`[2] Enqueued Job`);
    // 3. Poll for result
    console.log(`[3] Waiting for processing...`);
    // Check DB every 1s
    let attempts = 0;
    while (attempts < 10) {
        await new Promise(r => setTimeout(r, 1000));
        const checked = await prisma.webhookEvent.findUnique({ where: { id: event.id } });
        if (checked?.processingStatus === 'DONE') {
            console.log("✅ SMOKE TEST PASSED: Event Processed Successfully!");
            // Check AutomationRun
            const run = await prisma.automationRun.findFirst({
                where: { webhookEventId: event.id }
            });
            if (run) {
                console.log(`   -> Automation Run Created: ${run.id} Status: ${run.status}`);
            }
            else {
                console.log("   -> No Automation Run found (Did you have an active workflow mock?)");
            }
            break;
        }
        else if (checked?.processingStatus === 'ERROR') {
            console.error("❌ SMOKE TEST FAILED: Event Error", checked.lastError);
            break;
        }
        attempts++;
    }
    if (attempts >= 10) {
        console.log("❌ SMOKE TEST TIMEOUT");
    }
    process.exit(0);
}
main();
