import { policyEngine } from "./policy-engine";
import { detectMarketingContent } from "./message-classifier";
import { templateRegistry } from "./template-registry";
import { ComplianceError } from "./types";

interface ValidationRequest {
    text?: string;
    templateId?: string;
    category?: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
    lastInteractionAt?: Date | null;
    context?: any;
}

export const complianceGuard = {
    async validateJob(req: ValidationRequest) {
        const isWithin24h = policyEngine.isWithin24hWindow(req.lastInteractionAt);

        // 1. Content Validation
        if (!isWithin24h && req.text) {
            if (detectMarketingContent(req.text)) {
                throw new ComplianceError(
                    "Marketing keywords detected outside 24h window",
                    "MARKETING_CONTENT_BLOCKED"
                );
            }
        }

        // 2. Policy Validation
        let isTemplateApproved = false;
        if (req.templateId) {
            const template = await templateRegistry.getTemplate(req.templateId);
            if (template) {
                isTemplateApproved = template.approved;
                // Verify category match if provided
                if (req.category && template.category !== req.category) {
                    throw new ComplianceError(
                        `Template category ${template.category} does not match request category ${req.category}`,
                        "CATEGORY_MISMATCH"
                    );
                }
            } else {
                if (!isWithin24h) {
                    throw new ComplianceError("Template not found", "TEMPLATE_NOT_FOUND");
                }
            }
        } else if (!isWithin24h) {
            // Outside 24h MUST have a template
            throw new ComplianceError(
                "Messages outside 24h window must use a template",
                "MISSING_TEMPLATE"
            );
        }

        try {
            policyEngine.validateBroadcastPolicy({
                lastInteractionAt: req.lastInteractionAt,
                messageCategory: req.category,
                isTemplateApproved
            });
        } catch (error) {
            if (error instanceof Error) {
                throw new ComplianceError(error.message, "POLICY_VIOLATION");
            }
            throw error;
        }

        return { valid: true };
    }
};
