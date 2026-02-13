
import { MessagePolicyType, classifyMessageType, isWindowOpen } from "../messenger-policy";

export interface TemplateDefinition {
    id: string;
    name: string;
    category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION' | 'BUSINESS' | 'PROMOTIONAL' | 'BROADCAST';
    contentJson: any; // Simplified for now
    variablesJson?: any;
    policy: '24H' | 'UTILITY' | 'TAGGED';
}

export interface RenderContext {
    variables: Record<string, string>;
    recipient: {
        id: string;
        firstName?: string;
        lastName?: string;
    };
}

export const TemplateEngine = {
    /**
     * Validates if a template can be sent based on current policy rules.
     */
    validatePolicy(template: TemplateDefinition, lastInteractionAt: Date | null): { allowed: boolean; reason?: string } {
        const isWindow = isWindowOpen(lastInteractionAt);

        // 1. If 24H Policy -> Must be within window
        if (template.policy === '24H') {
            if (!isWindow) return { allowed: false, reason: "OUTSIDE_24H_WINDOW" };
            return { allowed: true };
        }

        // 2. If Utility/Tagged -> Example: Allowed outside if it's strictly utility
        if (template.policy === 'UTILITY' || template.policy === 'TAGGED') {
            // Logic: Utility can be sent outside 24h IF it complies with Meta tags (e.g. ACCOUNT_UPDATE)
            // We assume if it's marked as UTILITY in our system, it's safe to send via Message Tag.
            // Meta might still block if it's promotional.
            if (template.category === 'PROMOTIONAL' && !isWindow) {
                return { allowed: false, reason: "PROMOTIONAL_CONTENT_OUTSIDE_24H" };
            }
            return { allowed: true };
        }

        return { allowed: false, reason: "UNKNOWN_POLICY" };
    },

    /**
     * Renders the template content with variables.
     * Simple handlebars-style {{variable}} replacement.
     */
    renderTemplate(contentJson: any, context: RenderContext): any {
        // Deep clone to avoid mutating original
        let jsonString = JSON.stringify(contentJson);

        // 1. System Variables
        jsonString = jsonString.replace(/{{first_name}}/g, context.recipient.firstName || '');
        jsonString = jsonString.replace(/{{last_name}}/g, context.recipient.lastName || '');
        jsonString = jsonString.replace(/{{recipient_id}}/g, context.recipient.id || '');

        // 2. Custom Variables
        for (const [key, value] of Object.entries(context.variables)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            jsonString = jsonString.replace(regex, value);
        }

        return JSON.parse(jsonString);
    },

    /**
     * Builds the final Messenger API Payload
     */
    buildMessengerPayload(template: TemplateDefinition, renderedContent: any, recipientId: string) {
        // Structure depends on contentJson. 
        // Assuming contentJson IS the 'message' object or 'attachment' object.

        const payload: any = {
            recipient: { id: recipientId },
            message: renderedContent
        };

        if (template.policy === 'UTILITY' || template.policy === 'TAGGED') {
            payload.messaging_type = "MESSAGE_TAG";
            payload.tag = "ACCOUNT_UPDATE"; // Default fallback, or store specifically in template.
            // Ideally template.category maps to specific tags.
            // UTILITY -> ACCOUNT_UPDATE / CONFIRMED_EVENT_UPDATE
        } else {
            payload.messaging_type = "RESPONSE";
        }

        return payload;
    }
};
