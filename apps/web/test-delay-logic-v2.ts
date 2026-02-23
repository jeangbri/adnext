import { executeActionsUntilDelay } from './src/lib/messenger-service';

// Mock dependencies
jest.mock('./src/lib/messenger-service', () => {
    const original = jest.requireActual('./src/lib/messenger-service');
    return {
        ...original,
        sendAction: jest.fn().mockResolvedValue(true)
    };
});
jest.mock('./src/lib/scheduler', () => ({
    saveAndScheduleExecution: jest.fn().mockResolvedValue(true),
    clearExecution: jest.fn().mockResolvedValue(true)
}));

async function main() {
    const rule = {
        id: 'mock-rule',
        actions: [
            { id: '1', delayMs: 0 },
            { id: '2', delayMs: 5 * 60 * 1000 },
            { id: '3', delayMs: 20 * 60 * 1000 },
        ]
    };
    const page = { pageId: 'page' };
    const contact = { id: 1, psid: '123' };

    console.log('--- Initial Run (i=0)');
    await executeActionsUntilDelay(rule, page, contact, 0, 'run-1', 'ref1', undefined, false);

    console.log('--- Resuming Action 1 (i=1)');
    await executeActionsUntilDelay(rule, page, contact, 1, 'run-1', 'ref1', undefined, true);

    console.log('--- Resuming Action 2 (i=2)');
    await executeActionsUntilDelay(rule, page, contact, 2, 'run-1', 'ref1', undefined, true);
}

main().catch(console.error);
