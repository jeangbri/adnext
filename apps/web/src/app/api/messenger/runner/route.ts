
import { NextResponse } from "next/server";
import { delayQueue } from "@/lib/messenger/delay-queue";
import { executeActionsUntilDelay } from "@/lib/messenger-service";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        // Optional Secret Check (if env is set)
        const authHeader = req.headers.get('authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            // Silently return or 401. 
            // return new NextResponse('Unauthorized', { status: 401 });
        }

        const jobs = await delayQueue.getDueJobs(50);
        if (!jobs || jobs.length === 0) {
            return NextResponse.json({ processed: 0 });
        }

        const stats = { success: 0, failed: 0 };
        const processedIds: string[] = [];

        await Promise.all(jobs.map(async (job) => {
            try {
                // Remove from queue immediately or after? 
                // We ack at end.

                // 1. Fetch Context
                const page = await prisma.messengerPage.findUnique({
                    where: { pageId: job.pageId },
                    include: { workspace: true }
                });

                const contact = await prisma.contact.findFirst({
                    where: { pageId: job.pageId, psid: job.userId }
                });

                const rule = await prisma.automationRule.findUnique({
                    where: { id: job.ruleId },
                    include: { actions: { orderBy: { order: 'asc' } } }
                });

                if (!page || !contact || !rule) {
                    console.warn(`[Runner] Context Missing for job ${job.executionId}`);
                    processedIds.push(job.executionId); // Ack to remove
                    stats.failed++;
                    return;
                }

                // 2. Resume Execution
                await executeActionsUntilDelay(
                    rule,
                    page,
                    contact,
                    job.stepIndex,
                    job.executionId,
                    job.context?.refLogId || '',
                    job.replyToCommentId,
                    true // isResuming
                );

                processedIds.push(job.executionId);
                stats.success++;

            } catch (e) {
                console.error(`[Runner] Job ${job.executionId} failed`, e);
                // We Ack it to prevent infinite loop, assuming logic error. 
                // If transient, we might want to retry? 
                // For now, ack.
                processedIds.push(job.executionId);
                stats.failed++;
            }
        }));

        if (processedIds.length > 0) {
            await delayQueue.ack(processedIds);
        }

        return NextResponse.json({ processed: jobs.length, stats });
    } catch (e: any) {
        console.error("Runner Error", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
