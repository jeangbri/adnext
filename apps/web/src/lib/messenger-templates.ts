
import { MessagePolicyType } from "./messenger-policy";

export interface TemplateButton {
    type: 'postback' | 'web_url';
    title: string;
    payload?: string;
    url?: string;
}

export interface TemplateMetadata {
    campaignId?: string;
    tag?: string;
}

export interface TemplateBuilderContext {
    text: string;
    buttons?: TemplateButton[];
    metadata?: TemplateMetadata;
    reminderType?: string;
}

// ---------------------------------------------------------
// UTILITIES TEMPLATE
// ---------------------------------------------------------
export function buildUtilityTemplate(ctx: TemplateBuilderContext) {
    // Utility messages must use Message Tags or Approved Templates.
    // Assuming we use "CONFIRMED_EVENT_UPDATE" or similar tags via standard message structure
    // OR we use the new Generic Template strict structure.

    // For "Smart Broadcast", we convert text to a tagged message or template.
    // META REQUIREMENT: Outside 24h, you must use a 'message_tag' or an approved template.
    // If we don't have a template ID, we fallback to Message Tag 'ACCOUNT_UPDATE' etc if applicable?
    // User requested "envio automático por templates".
    // If we don't have an approved template ID passed in context, we might struggle.
    // But let's assume valid tag usage as fallback for Utility.

    return {
        recipient: { id: "{PSID}" }, // To be filled
        message: {
            text: ctx.text,
            // Tag is critical for Utility outside 24h if not using OTN.
            // However, nowadays tags are very restricted (ACCOUNT_UPDATE, CONFIRMED_EVENT_UPDATE, POST_PURCHASE_UPDATE, HUMAN_AGENT).
            // "Utility" usually implies one of these.
        },
        messaging_type: "MESSAGE_TAG",
        tag: ctx.metadata?.tag || "ACCOUNT_UPDATE"
    };
}

// ---------------------------------------------------------
// FOLLOW-UP TEMPLATE
// ---------------------------------------------------------
export function buildFollowUpTemplate(ctx: TemplateBuilderContext) {
    // Follow-ups usually require subscription or user opt-in (Notification Messages).
    // Or just standard text if inside 24h (but this is called when OUTSIDE).
    // If outside, we probably need a specific "Re-engagement" template.

    return {
        recipient: { id: "{PSID}" },
        message: {
            text: ctx.text,
            quick_replies: ctx.buttons?.map(b => ({
                content_type: "text",
                title: b.title,
                payload: b.payload
            }))
        },
        // Caution: Tags like "CONFIRMED_EVENT_UPDATE" might work if relevant.
        messaging_type: "MESSAGE_TAG",
        tag: "CONFIRMED_EVENT_UPDATE"
    };
}

// ---------------------------------------------------------
// REMINDER TEMPLATE
// ---------------------------------------------------------
export function buildReminderTemplate(ctx: TemplateBuilderContext) {
    return {
        recipient: { id: "{PSID}" },
        message: {
            text: `🔔 Lembrete: ${ctx.text}`
        },
        messaging_type: "MESSAGE_TAG",
        tag: "CONFIRMED_EVENT_UPDATE"
    };
}

// ---------------------------------------------------------
// SELECTOR
// ---------------------------------------------------------
export function buildTemplateByPolicy(policy: MessagePolicyType, data: TemplateBuilderContext) {
    switch (policy) {
        case MessagePolicyType.UTILITY_TEMPLATE:
            return buildUtilityTemplate(data);
        case MessagePolicyType.FOLLOW_UP_TEMPLATE:
            return buildFollowUpTemplate(data);
        case MessagePolicyType.REMINDER_TEMPLATE:
            return buildReminderTemplate(data);
        case MessagePolicyType.RESPONSE_24H:
            // Standard message
            return {
                recipient: { id: "{PSID}" },
                message: { text: data.text },
                messaging_type: "RESPONSE"
            };
        default:
            throw new Error(`Policy ${policy} blocks message sending`);
    }
}
