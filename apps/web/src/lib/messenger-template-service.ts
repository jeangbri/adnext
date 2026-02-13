
import { prisma } from "../prisma";
import { delayQueue } from "./messenger/delay-queue";
import { MessagePolicyType, classifyMessageType } from "./messenger-policy";
import { TemplateEngine } from "./templates/template-engine";
import { decrypt } from "./encryption";

export const TemplateService = {
    /**
     * Get template by ID
     */
    async getTemplate(id: string) {
        return prisma.messengerTemplate.findUnique({ where: { id } });
    },

    /**
     * List templates for a page
     */
    async listTemplates(pageId: string) {
        return prisma.messengerTemplate.findMany({ where: { pageId } });
    },

    /**
     * Send a template message
     */
    async sendTemplateMessage(
        templateId: string,
        recipientId: string,
        variables: Record<string, string>,
        pageId: string,
        refLogId?: string
    ) {
        // 1. Fetch Context
        const page = await prisma.messengerPage.findUnique({ where: { pageId } });
        const contact = await prisma.contact.findFirst({ where: { pageId, psid: recipientId } });
        const template = await prisma.messengerTemplate.findUnique({ where: { id: templateId } });

        if (!page || !template) throw new Error("Template or Page not found");

        // 2. Validate Policy
        const conversation = await prisma.conversation.findUnique({ where: { pageId_psid: { pageId, psid: recipientId } } });
        const lastInteraction = conversation?.lastInteractionAt || null;

        // Policy Check via Engine
        const canSend = TemplateEngine.validatePolicy({
            id: template.id,
            name: template.name,
            category: template.category as any, // Cast to engine types
            contentJson: template.contentJson,
            policy: template.policy as any
        }, lastInteraction);

        if (!canSend.allowed) {
            throw new Error(`Sending Blocked: ${canSend.reason}`);
        }

        // 3. Render Message
        const renderedContent = TemplateEngine.renderTemplate(template.contentJson, {
            variables: variables,
            recipient: {
                id: recipientId,
                firstName: contact?.firstName || "",
                lastName: contact?.lastName || ""
            }
        });

        // 4. Build Payload
        const payload = TemplateEngine.buildMessengerPayload({
            id: template.id,
            name: template.name,
            category: template.category as any,
            contentJson: template.contentJson,
            policy: template.policy as any
        }, renderedContent, recipientId);

        // 5. Send via Graph API
        const token = decrypt(page.pageAccessToken);
        const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`;

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        // 6. Log Result
        // Log to TemplateLog
        await prisma.templateLog.create({
            data: {
                templateId: templateId,
                recipientId: recipientId,
                policyUsed: template.policy, // '24H' or 'UTILITY'
                status: res.ok ? 'SENT' : 'FAILED',
                responseMeta: data
            }
        });

        if (!res.ok) {
            throw new Error(data.error?.message || "Failed to send template");
        }

        return data;
    }
};
