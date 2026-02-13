
export enum MessagePolicyType {
    RESPONSE_24H = 'RESPONSE_24H',
    UTILITY_TEMPLATE = 'UTILITY_TEMPLATE',
    FOLLOW_UP_TEMPLATE = 'FOLLOW_UP_TEMPLATE',
    REMINDER_TEMPLATE = 'REMINDER_TEMPLATE',
    BLOCKED = 'BLOCKED'
}

export interface PolicyContext {
    lastInteractionAt: Date | null | number;
    messageType?: string; // 'text', 'image', etc.
    isBroadcast?: boolean;
    tag?: string; // e.g. 'CONFIRMED_EVENT_UPDATE'
    flowType?: 'standard' | 'followup' | 'reminder';
}

export function classifyMessageType(context: PolicyContext): MessagePolicyType {
    const { lastInteractionAt, isBroadcast, flowType } = context;

    // 1. Check 24h Window
    const now = Date.now();
    const lastInteraction = lastInteractionAt ? new Date(lastInteractionAt).getTime() : 0;
    const isWithin24h = (now - lastInteraction) < (24 * 60 * 60 * 1000);

    if (isWithin24h) {
        return MessagePolicyType.RESPONSE_24H;
    }

    // 2. Outside 24h Logic
    if (isBroadcast) {
        // Broadcasts outside 24h MUST be Utility or Marketing (Template)
        // We default to UTILITY_TEMPLATE as the safe conversion target for "Smart Broadcast"
        return MessagePolicyType.UTILITY_TEMPLATE;
    }

    if (flowType === 'followup') {
        return MessagePolicyType.FOLLOW_UP_TEMPLATE;
    }

    if (flowType === 'reminder') {
        return MessagePolicyType.REMINDER_TEMPLATE;
    }

    // 3. Default Block if no template strategy applies
    // If we try to send a standard message outside 24h without being a broadcast/flow specific, it's blocked.
    return MessagePolicyType.BLOCKED;
}

export function isWindowOpen(lastInteractionAt: Date | null | number): boolean {
    const now = Date.now();
    const lastInteraction = lastInteractionAt ? new Date(lastInteractionAt).getTime() : 0;
    return (now - lastInteraction) < (24 * 60 * 60 * 1000);
}
