import { policyEngine } from "./policy-engine";
import { detectMarketingContent } from "./message-classifier";
import { complianceGuard } from "./compliance-guard";
import { templateRegistry } from "./template-registry";
import { ComplianceError } from "./types";

// Mocks
jest.mock("./template-registry");

describe('Broadcast V2 Logic Tests', () => {

    describe('Message Classifier', () => {
        test('detects marketing keywords', () => {
            expect(detectMarketingContent("Temos uma oferta imperdível")).toBe(true);
            expect(detectMarketingContent("Confira nossa promoção")).toBe(true);
            expect(detectMarketingContent("Olá, como vai?")).toBe(false);
        });
    });

    describe('Policy Engine', () => {
        test('allows everything within 24h', () => {
            const result = policyEngine.validateBroadcastPolicy({
                lastInteractionAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
            });
            expect(result.allowed).toBe(true);
            expect(result.type).toBe('STANDARD');
        });

        test('outside 24h requires approved template', () => {
            expect(() => {
                policyEngine.validateBroadcastPolicy({
                    lastInteractionAt: new Date(Date.now() - 1000 * 60 * 60 * 25), // 25 hours ago
                    messageCategory: 'UTILITY',
                    isTemplateApproved: false
                });
            }).toThrow("Messages outside 24h window must use an approved template");
        });

        test('outside 24h requires UTILITY category', () => {
            expect(() => {
                policyEngine.validateBroadcastPolicy({
                    lastInteractionAt: new Date(Date.now() - 1000 * 60 * 60 * 25), // 25 hours ago
                    messageCategory: 'MARKETING', // Invalid category
                    isTemplateApproved: true
                });
            }).toThrow("Messages outside 24h window must be UTILITY or AUTHENTICATION");
        });
    });

    describe('Compliance Guard', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('validates marketing content blocking outside 24h', async () => {
            await expect(complianceGuard.validateJob({
                text: "Super promoção!",
                lastInteractionAt: new Date(Date.now() - 1000 * 60 * 60 * 25)
            })).rejects.toThrow("Marketing keywords detected outside 24h window");
        });

        test('validates valid utility send', async () => {
            (templateRegistry.getTemplate as jest.Mock).mockResolvedValue({
                id: 't1',
                approved: true,
                category: 'UTILITY'
            });

            await expect(complianceGuard.validateJob({
                templateId: 't1',
                category: 'UTILITY',
                lastInteractionAt: new Date(Date.now() - 1000 * 60 * 60 * 25)
            })).resolves.toEqual({ valid: true });
        });
    });
});
