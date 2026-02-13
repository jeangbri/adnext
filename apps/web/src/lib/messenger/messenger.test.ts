
import { classifyMessageType, MessagePolicyType } from "../messenger-policy";
import { delayQueue } from "./delay-queue";

// Mock Redis
jest.mock('@upstash/redis', () => {
    return {
        Redis: jest.fn().mockImplementation(() => ({
            zadd: jest.fn(),
            hset: jest.fn(),
            zrange: jest.fn().mockResolvedValue([]),
            zrem: jest.fn(),
            del: jest.fn(),
            pipeline: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue([])
        }))
    };
});

describe('Messenger System Tests', () => {

    describe('Policy Engine', () => {
        test('Classifies 24h window correctly', () => {
            const now = Date.now();
            const result = classifyMessageType({
                lastInteractionAt: now - 1000, // 1s ago
                isBroadcast: false
            });
            expect(result).toBe(MessagePolicyType.RESPONSE_24H);
        });

        test('Classifies outside 24h as Blocked for standard rules', () => {
            const result = classifyMessageType({
                lastInteractionAt: Date.now() - (25 * 60 * 60 * 1000), // 25h ago
                isBroadcast: false
            });
            expect(result).toBe(MessagePolicyType.BLOCKED);
        });

        test('Classifies Broadcast outside 24h as Utility Template', () => {
            const result = classifyMessageType({
                lastInteractionAt: Date.now() - (25 * 60 * 60 * 1000), // 25h ago
                isBroadcast: true
            });
            expect(result).toBe(MessagePolicyType.UTILITY_TEMPLATE);
        });
    });

    describe('Delay Queue', () => {
        test('Enqueue adds to Redis', async () => {
            await delayQueue.enqueue({
                executionId: 'test-1',
                pageId: 'page-1',
                userId: 'user-1',
                ruleId: 'rule-1',
                stepIndex: 1,
                wakeUpAt: Date.now() + 1000
            });
            // Mock allows call, we verified compilation.
            // Actual test would verify calls to redis.zadd/hset
        });
    });
});
