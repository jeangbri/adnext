import { differenceInHours } from "date-fns";
import { ComplianceError } from "./types";
import { MessageCategory } from "./types";

interface PolicyContext {
    lastInteractionAt?: Date | null;
    messageCategory?: MessageCategory;
    isTemplateApproved?: boolean;
}

export const policyEngine = {
    validateBroadcastPolicy(ctx: PolicyContext) {
        const isWithin24h = ctx.lastInteractionAt
            ? differenceInHours(new Date(), new Date(ctx.lastInteractionAt)) < 24
            : false;

        if (isWithin24h) {
            // Free text allowed
            // Buttons allowed
            // Cards allowed
            return { allowed: true, type: 'STANDARD' };
        }

        // Outside 24h window checks

        // 1. Must be Utility or Authentication
        if (ctx.messageCategory !== 'UTILITY' && ctx.messageCategory !== 'AUTHENTICATION') {
            throw new ComplianceError(
                "Messages outside 24h window must be UTILITY or AUTHENTICATION",
                "INVALID_CATEGORY_OUTSIDE_24H"
            );
        }

        // 2. Must use approved template
        if (!ctx.isTemplateApproved) {
            throw new ComplianceError(
                "Messages outside 24h window must use an approved template",
                "TEMPLATE_NOT_APPROVED"
            );
        }

        return { allowed: true, type: 'UTILITY' };
    },

    isWithin24hWindow(lastInteractionAt?: Date | null): boolean {
        if (!lastInteractionAt) return false;
        return differenceInHours(new Date(), new Date(lastInteractionAt)) < 24;
    }
};
