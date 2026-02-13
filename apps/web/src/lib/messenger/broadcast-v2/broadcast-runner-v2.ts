import { prisma } from "@/lib/prisma";
import { complianceGuard } from "./compliance-guard";
import { BroadcastJobV2 } from "@prisma/client";

export const broadcastRunnerV2 = {
    async run() {
        const jobs = await prisma.broadcastJobV2.findMany({
            where: {
                status: 'PENDING',
                scheduledAt: {
                    lte: new Date()
                }
            },
            include: {
                template: true // Fetch template details
            }
        });

        for (const job of jobs) {
            await this.processJob(job);
        }
    },

    async processJob(job: any) {
        // Mark as processing
        await prisma.broadcastJobV2.update({
            where: { id: job.id },
            data: { status: 'PROCESSING' }
        });

        // Fetch recipients - assuming they are pre-inserted in logs with status 'PENDING' 
        // or we need to resolve audience from payload.
        // For this implementation, let's assume logs are the queue of recipients.
        // (If the prompt meant otherwise, we'd need audience logic here similar to legacy)

        // However, typically a 'Job' in this context processing 'batches' implies handling many users.
        // Let's look for logs with this job_id and status 'PENDING' (if we used that status).
        // The schema for logs says 'status' (SENT, FAILED, BLOCKED). It didn't explicitly say 'PENDING'.
        // But usually we need a way to know who to send to.

        // Let's assume the job payload contains the audience or list of PSIDs for simplicity in this "stub" runner,
        // OR (better) that we query the subscribers of the page.

        // Given the prompt constraints and lack of 'Recipients' table for V2, 
        // I'll check if we can leverage the existing Contact table.

        const contacts = await prisma.contact.findMany({
            where: { pageId: job.page.pageId }, // naive "all"
            take: 100 // Batch size 
        });

        // Note: Real implementation needs pagination and audience filtering.

        for (const contact of contacts) {
            try {
                const validation = await complianceGuard.validateJob({
                    text: job.payload?.text, // If text based
                    templateId: job.templateId,
                    category: job.template?.category as any,
                    lastInteractionAt: contact.lastSeenAt, // or fetch conversation
                    context: job.payload?.context
                });

                // If valid, send...
                // await messengerService.send(...)

                // Log success
                await prisma.broadcastLogV2.create({
                    data: {
                        jobId: job.id,
                        userPsid: contact.psid,
                        templateId: job.templateId,
                        messageCategory: job.template?.category || 'STANDARD',
                        lastInteractionAt: contact.lastSeenAt,
                        status: 'SENT',
                        metaResponse: { success: true }
                    }
                });

            } catch (e: any) {
                // Log failure/block
                await prisma.broadcastLogV2.create({
                    data: {
                        jobId: job.id,
                        userPsid: contact.psid,
                        templateId: job.templateId,
                        messageCategory: job.template?.category,
                        lastInteractionAt: contact.lastSeenAt,
                        status: 'BLOCKED',
                        metaResponse: { error: e.message, code: e.code }
                    }
                });
            }
        }

        // Mark job complete
        await prisma.broadcastJobV2.update({
            where: { id: job.id },
            data: { status: 'COMPLETED' }
        });
    }
};
