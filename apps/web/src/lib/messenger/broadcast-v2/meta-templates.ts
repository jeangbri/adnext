/**
 * Meta-accepted message templates for Messenger Platform.
 *
 * As of Feb 2026, Message Tags are deprecated. The remaining options for
 * out-of-24h messaging are:
 *  - One-Time Notification (OTN)
 *  - Recurring Notifications (with user opt-in)
 *  - Sponsored Messages (paid)
 *
 * However, many pages still have legacy Message Tag support during the
 * transition period, and the "Utility" category persists for transactional messages.
 *
 * This file defines the default templates that can be auto-seeded per page.
 */

export interface MetaTemplateDefinition {
    name: string;
    category: string;
    description: string;
    policy: string;
    contentJson: Record<string, any>;
    tag?: string; // Legacy Message Tag (if applicable)
}

export const META_DEFAULT_TEMPLATES: MetaTemplateDefinition[] = [
    // === UTILITY TEMPLATES (Transactional, allowed outside 24h) ===
    {
        name: "Atualização de Conta",
        category: "UTILITY",
        description: "Notifica o usuário sobre uma mudança não recorrente na conta ou aplicativo. Ex: mudança de senha, atualização de perfil.",
        policy: "UTILITY",
        tag: "ACCOUNT_UPDATE",
        contentJson: {
            type: "text",
            template: "Olá {{first_name}}, houve uma atualização na sua conta: {{update_details}}",
            variables: ["first_name", "update_details"]
        }
    },
    {
        name: "Atualização Pós-Compra",
        category: "UTILITY",
        description: "Notifica sobre atualizações de compras recentes. Ex: confirmação de envio, rastreamento, entrega.",
        policy: "UTILITY",
        tag: "POST_PURCHASE_UPDATE",
        contentJson: {
            type: "text",
            template: "Olá {{first_name}}, sua compra #{{order_id}} foi atualizada: {{status_update}}",
            variables: ["first_name", "order_id", "status_update"]
        }
    },
    {
        name: "Atualização de Evento Confirmado",
        category: "UTILITY",
        description: "Envia lembretes ou atualizações para um evento que o usuário se inscreveu. Ex: mudança de horário, local.",
        policy: "UTILITY",
        tag: "CONFIRMED_EVENT_UPDATE",
        contentJson: {
            type: "text",
            template: "Olá {{first_name}}, atualização sobre o evento {{event_name}}: {{event_details}}",
            variables: ["first_name", "event_name", "event_details"]
        }
    },
    {
        name: "Agente Humano",
        category: "UTILITY",
        description: "Permite um agente humano responder dentro de 7 dias. Não pode ser usado para mensagens automatizadas.",
        policy: "UTILITY",
        tag: "HUMAN_AGENT",
        contentJson: {
            type: "text",
            template: "{{message}}",
            variables: ["message"]
        }
    },

    // === ONE-TIME NOTIFICATION (OTN) ===
    {
        name: "Notificação Única (OTN)",
        category: "UTILITY",
        description: "Envia uma mensagem de follow-up única ao usuário que deu permissão. O usuário precisa ter feito opt-in.",
        policy: "UTILITY",
        tag: "ONE_TIME_NOTIFICATION",
        contentJson: {
            type: "text",
            template: "Olá {{first_name}}, conforme combinado: {{message_content}}",
            variables: ["first_name", "message_content"]
        }
    },

    // === RECURRING NOTIFICATION ===
    {
        name: "Notificação Recorrente (Opt-in)",
        category: "UTILITY",
        description: "Envia notificações recorrentes para usuários que optaram por receber. Requer opt-in explícito do contato.",
        policy: "UTILITY",
        contentJson: {
            type: "text",
            template: "Olá {{first_name}}, aqui está sua atualização: {{update_content}}",
            variables: ["first_name", "update_content"]
        }
    },

    // === BROADCAST TEMPLATES (dentro da janela 24h, texto livre) ===
    {
        name: "Mensagem Promocional (24h)",
        category: "MARKETING",
        description: "Mensagem promocional livre, só pode ser enviada dentro da janela de 24h. Promoções, ofertas, novidades.",
        policy: "24H",
        contentJson: {
            type: "text",
            template: "{{message}}",
            variables: ["message"]
        }
    },
    {
        name: "Lembrete de Carrinho Abandonado",
        category: "UTILITY",
        description: "Lembra o usuário sobre itens no carrinho. Classificado como Utility por ser transacional.",
        policy: "UTILITY",
        contentJson: {
            type: "text",
            template: "Olá {{first_name}}, você deixou itens no seu carrinho! Finalize sua compra antes que o estoque acabe.",
            variables: ["first_name"]
        }
    },
    {
        name: "Confirmação de Agendamento",
        category: "UTILITY",
        description: "Confirma ou lembra sobre um agendamento marcado pelo usuário.",
        policy: "UTILITY",
        contentJson: {
            type: "text",
            template: "Olá {{first_name}}, seu agendamento para {{date}} às {{time}} está confirmado. Responda se precisar reagendar.",
            variables: ["first_name", "date", "time"]
        }
    },
    {
        name: "Alerta de Pagamento",
        category: "UTILITY",
        description: "Notifica sobre status de pagamento - vencimento, confirmação ou falha.",
        policy: "UTILITY",
        contentJson: {
            type: "text",
            template: "Olá {{first_name}}, informamos que seu pagamento de R${{amount}} {{payment_status}}.",
            variables: ["first_name", "amount", "payment_status"]
        }
    }
];

/**
 * Returns only templates that are valid for out-of-24h sending (Utility policy)
 */
export function getUtilityTemplates(): MetaTemplateDefinition[] {
    return META_DEFAULT_TEMPLATES.filter(t => t.policy === 'UTILITY');
}

/**
 * Returns all template definitions
 */
export function getAllTemplateDefinitions(): MetaTemplateDefinition[] {
    return META_DEFAULT_TEMPLATES;
}
