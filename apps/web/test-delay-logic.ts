import { executeActionsUntilDelay } from './src/lib/messenger-service';
import { prisma } from './src/lib/prisma';
import { executeActionsUntilDelay as mockExecute } from './src/lib/messenger-service';

// We just mock the schedule to see what gets passed
jest.mock('./src/lib/scheduler', () => ({
    saveAndScheduleExecution: jest.fn(),
    clearExecution: jest.fn()
}));
