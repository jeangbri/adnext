import { z } from 'zod';

export const createWorkflowSchema = z.object({
    title: z.string().min(1, "O título é obrigatório"),
    description: z.string().optional(),
    folderId: z.string().optional(),
    channels: z.array(z.string()).min(1, "Selecione pelo menos um canal"),
});

export const updateWorkflowSchema = z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
});
