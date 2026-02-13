export type MessageCategory = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
export type PolicyType = 'STANDARD' | 'UTILITY';

export class ComplianceError extends Error {
    code: string;
    constructor(message: string, code: string) {
        super(message);
        this.code = code;
        this.name = 'ComplianceError';
    }
}

export interface BroadcastPayload {
    text?: string;
    templateId?: string;
    context?: Record<string, any>;
}
