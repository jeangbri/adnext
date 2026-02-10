import { getExecutionState, clearExecution } from "@/lib/scheduler";
import { executeActionsUntilDelay } from "@/lib/messenger-service";
import { prisma } from "@/lib/prisma";

export async function processExecution(executionId: string) {
    // 1. Load State
    const state = await getExecutionState(executionId);
    if (!state) {
        console.log(`[Processor] State not found for ${executionId}`);
        return { status: "NOT_FOUND" };
    }

    // 2. Validate Timing
    // For manual runner/sweep, we assume it's due because we fetched from ZSET with score <= now
    // But double check doesn't hurt.
    if (Date.now() < state.runAt - 5000) {
        return { status: "TOO_EARLY", runAt: state.runAt };
    }

    // 3. Hydrate Data
    const page = await prisma.messengerPage.findUnique({
        where: { pageId: state.pageId },
        include: { workspace: true }
    });

    if (!page || !page.isActive) {
        console.log(`[Processor] Page ${state.pageId} inactive or missing`);
        await clearExecution(executionId);
        return { status: "PAGE_INACTIVE" };
    }

    const contact = await prisma.contact.findUnique({
        where: { pageId_psid: { pageId: state.pageId, psid: state.psid } }
    });

    if (!contact) {
        console.log(`[Processor] Contact ${state.psid} missing`);
        await clearExecution(executionId);
        return { status: "CONTACT_MISSING" };
    }

    const rule = await prisma.automationRule.findUnique({
        where: { id: state.ruleId },
        include: { actions: { orderBy: { order: 'asc' } } }
    });

    if (!rule || !rule.isActive) {
        console.log(`[Processor] Rule ${state.ruleId} inactive or missing`);
        await clearExecution(executionId);
        return { status: "RULE_INACTIVE" };
    }

    // 4. Resume Execution
    try {
        console.log(`[Processor] Resuming execution ${executionId} (Index: ${state.nextIndex})`);

        // Remove from ZSET immediately to prevent double-processing? 
        // No, executeActionsUntilDelay handles re-scheduling if needed, OR clearExecution on DONE.
        // If we crash, we want it to retry? 
        // If we remove now, and crash, we lose it.
        // If we don't remove, and crash, next helper picks it up.
        // BUT executeActionsUntilDelay is not idempotent if actions aren't.
        // We rely on "at least once" or "exactly once"?
        // Redis ZREM is atomic.
        // Let's remove from ZSET *after* successful processing start? Or use Lock?
        // Let's assume for now we just run. `executeActionsUntilDelay` clears execution on DONE.
        // If it pauses again, it overwrites the state/schedule.

        await executeActionsUntilDelay(
            rule,
            page,
            contact,
            state.nextIndex, // Resume index
            executionId,
            state.refLogId || 'runner',
            state.replyToCommentId
        );
        return { status: "SUCCESS" };
    } catch (e: any) {
        console.error(`[Processor] Execution ${executionId} failed`, e);
        return { status: "ERROR", error: e.message };
    }
}
