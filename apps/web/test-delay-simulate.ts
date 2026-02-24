import { executeActionsUntilDelay } from './src/lib/messenger-service';

// Mock dependencies manually if needed, 
// here we'll just test what executeActionsUntilDelay prints out, 
// wait, executeActions calls saveAndScheduleExecution which we don't want to actually run.

// Let's copy the logic out:

function executeLogic(
    actions: any[],
    initialIndex: number,
    isResuming = false
) {
    for (let i = initialIndex; i < actions.length; i++) {
        const action = actions[i];
        const delayToWait = action.delayMs || 0;

        if (delayToWait > 0 && !(isResuming && i === initialIndex)) {
            console.log(`[Engine] Paused run at action ${i} for ${delayToWait}ms`);
            return { status: 'PAUSED' };
        }

        console.log(`[Engine] Executed action ${i}`);
    }

    console.log(`[Engine] Run completed.`);
    return { status: 'DONE' };
}

const actions = [
    { id: '1', delayMs: 0 },
    { id: '2', delayMs: 5 * 60 * 1000 },
    { id: '3', delayMs: 20 * 60 * 1000 },
];

console.log('--- Initial Run (i=0)');
executeLogic(actions, 0, false);

console.log('--- Resuming Action 1 (i=1)');
executeLogic(actions, 1, true);

console.log('--- Resuming Action 2 (i=2)');
executeLogic(actions, 2, true);
