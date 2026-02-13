import { prisma } from "@/lib/prisma";
import { MessageCategory } from "./types";

export interface CreateTemplateInput {
    pageId: string;
    name: string;
    category: MessageCategory;
    contentJson: any;
    metaTemplateId?: string;
}

export const templateRegistry = {
    async createTemplate(data: CreateTemplateInput) {
        return prisma.messengerTemplate.create({
            data: {
                pageId: data.pageId,
                name: data.name,
                category: data.category,
                contentJson: data.contentJson,
                metaTemplateId: data.metaTemplateId,
                approved: false, // Default to unapproved until reviewed
            }
        });
    },

    async updateTemplate(id: string, data: Partial<CreateTemplateInput>) {
        return prisma.messengerTemplate.update({
            where: { id },
            data
        });
    },

    async approveTemplate(id: string) {
        return prisma.messengerTemplate.update({
            where: { id },
            data: { approved: true }
        });
    },

    async getApprovedTemplatesByPage(pageId: string) {
        return prisma.messengerTemplate.findMany({
            where: {
                pageId,
                approved: true
            }
        });
    },

    async getTemplate(id: string) {
        return prisma.messengerTemplate.findUnique({
            where: { id }
        });
    }
};
