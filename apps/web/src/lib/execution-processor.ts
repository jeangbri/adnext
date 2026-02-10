import { getExecutionState, clearExecution, markProcessing, markFailed } from "@/lib/scheduler";
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
    if (Date.now() < state.runAt - 5000) {
        return { status: "TOO_EARLY", runAt: state.runAt };
    }

    // 3. Optimistic Lock: Mark as PROCESSING
    const acquired = await markProcessing(executionId);
    if (!acquired) {
        console.log(`[Processor] Could not acquire lock for ${executionId} (already processing or done)`);
        return { status: "ALREADY_PROCESSING" };
    }

    // 4. Hydrate Data
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

    // 5. Resume Execution
    try {
        console.log(`[Processor] Resuming execution ${executionId} (Index: ${state.nextIndex})`);

        await executeActionsUntilDelay(
            rule,
            page,
            contact,
            state.nextIndex,
            executionId,
            state.refLogId || 'runner',
            state.replyToCommentId
        );
        return { status: "SUCCESS" };
    } catch (e: any) {
        console.error(`[Processor] Execution ${executionId} failed`, e);
        await markFailed(executionId, e.message || 'Unknown error');
        return { status: "ERROR", error: e.message };
    }
}
