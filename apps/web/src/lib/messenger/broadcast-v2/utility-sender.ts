import { prisma } from "@/lib/prisma";
import { complianceGuard } from "./compliance-guard";
import { ComplianceError } from "./types";

interface SendUtilityInput {
    recipientPsid: string;
    templateId: string;
    pageId: string;
    context?: any;
}

export const utilitySender = {
    async sendUtilityMessage(input: SendUtilityInput) {
        // 1. Fetch context (last interaction)
        // We need to look up the contact or conversation to get actual lastInteractionAt
        // Ideally we look up the Conversation model
        const conversation = await prisma.conversation.findUnique({
            where: {
                pageId_psid: {
                    pageId: input.pageId,
                    psid: input.recipientPsid
                }
            }
        });

        const lastInteractionAt = conversation?.lastInteractionAt;

        // 2. Validate Compliance
        try {
            await complianceGuard.validateJob({
                templateId: input.templateId,
                category: 'UTILITY',
                lastInteractionAt: lastInteractionAt,
                context: input.context
            });
        } catch (error) {
            console.error("Compliance check failed", error);
            // Log failure to BroadcastLogsV2 ?? (Or just throw)
            throw error;
        }

        // 3. Send Message (Mocked for now, or use existing messenger service if available)
        // In a real implementation, this would call the Meta Send API with Message Tag: CONFIRMED_EVENT_UPDATE or similar
        // For V2, we assume 'UTILITY' maps to specific Meta tags based on the template category.

        // We'll log this as a "job" even if immediate
        const job = await prisma.broadcastJobV2.create({
            data: {
                pageId: input.pageId,
                policyType: 'UTILITY',
                templateId: input.templateId,
                status: 'COMPLETED', // valid utility send
                payload: input.context
            }
        });

        await prisma.broadcastLogV2.create({
            data: {
                jobId: job.id,
                userPsid: input.recipientPsid,
                templateId: input.templateId,
                messageCategory: 'UTILITY',
                lastInteractionAt: lastInteractionAt,
                status: 'SENT',
                metaResponse: { success: true, mock: "sent via utility-sender" }
            }
        });

        return { success: true, jobId: job.id };
    }
};
