"use client"

import { useState } from "react"
import { RuleEditor } from "../_components/rule-editor"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Phone, MessageSquare, ArrowLeft, Sparkles,
    Zap, FileText, ArrowRight, CheckCircle2
} from "lucide-react"
import Link from "next/link"

// ──────────────────────────────────────────
// QUIZ TEMPLATE DEFINITIONS
// ──────────────────────────────────────────

const QUIZ_LEAD_TEMPLATE = {
    name: "Quiz - Captura de Leads",
    keywords: [],
    matchType: "CONTAINS",
    triggerType: "MESSAGE_ANY",
    triggerConfig: {},
    isActive: true,
    priority: 10,
    cooldownSeconds: 0,
    pageIds: [],
    flow: {
        enabled: true,
        steps: [
            {
                id: "step_1",
                type: "question",
                message: "🎯 Olá! Vou te ajudar a encontrar a melhor opção!\n\nQual categoria te interessa mais?\n\n1️⃣ Opção A\n2️⃣ Opção B\n3️⃣ Opção C\n4️⃣ Opção D",
                expectedType: "keyword",
                conditions: [
                    { match: "1", nextStep: "step_2" },
                    { match: "2", nextStep: "step_2" },
                    { match: "3", nextStep: "step_2" },
                    { match: "4", nextStep: "step_2" },
                ],
                fallback: { message: "Por favor, escolha 1, 2, 3 ou 4 ☝️" }
            },
            {
                id: "step_2",
                type: "question",
                message: "Ótima escolha! 🔥\n\nAgora, qual faixa de valor você prefere?\n\n1️⃣ Até R$ 500\n2️⃣ R$ 500 - R$ 1.000\n3️⃣ R$ 1.000 - R$ 2.000\n4️⃣ Acima de R$ 2.000",
                expectedType: "keyword",
                conditions: [
                    { match: "1", nextStep: "step_3" },
                    { match: "2", nextStep: "step_3" },
                    { match: "3", nextStep: "step_3" },
                    { match: "4", nextStep: "step_3" },
                ],
                fallback: { message: "Escolha 1, 2, 3 ou 4 para continuar 😉" }
            },
            {
                id: "step_3",
                type: "question",
                message: "📱 Perfeito! Para te enviar as melhores opções, preciso do seu telefone com DDD.\n\nExemplo: (11) 99999-9999",
                expectedType: "phone",
                conditions: [
                    { match: "*", nextStep: "step_4" },
                ],
                fallback: { message: "📱 Por favor, digite um número de telefone válido com DDD.\nEx: (11) 99999-9999" }
            },
            {
                id: "step_4",
                type: "question",
                message: "✅ Pronto! Telefone salvo com sucesso!\n\nUm especialista vai entrar em contato com você em breve. 🚀\n\nObrigado pelo interesse! 💙",
                expectedType: "any",
                conditions: [],
                fallback: { message: "" }
            }
        ]
    },
    actions: []
}

const SIMPLE_RESPONSE_TEMPLATE = {
    name: "Resposta Automática",
    keywords: [],
    matchType: "CONTAINS",
    triggerType: "MESSAGE_ANY",
    triggerConfig: {},
    isActive: true,
    priority: 0,
    cooldownSeconds: 0,
    pageIds: [],
    flow: { enabled: false, steps: [] },
    actions: [
        {
            type: "MESSAGE_WITH_BUTTONS",
            delayMs: 0,
            payload: { message: "Olá! 👋 Como posso te ajudar?", buttons: [] }
        }
    ]
}

const COMMENT_TEMPLATE = {
    name: "Resposta a Comentário",
    keywords: [],
    matchType: "CONTAINS",
    triggerType: "COMMENT_ON_POST",
    triggerConfig: { ignoreOwnComments: true, postIds: [] },
    isActive: true,
    priority: 0,
    cooldownSeconds: 60,
    pageIds: [],
    flow: { enabled: false, steps: [] },
    actions: [
        {
            type: "MESSAGE_WITH_BUTTONS",
            delayMs: 0,
            payload: { message: "Obrigado pelo seu comentário! 💬\n\nVou te enviar mais detalhes por aqui.", buttons: [] }
        }
    ]
}

const templates = [
    {
        id: "quiz_lead",
        icon: Phone,
        title: "Quiz de Captura de Leads",
        description: "Fluxo conversacional com perguntas que guiam o lead até fornecer o telefone. Captura automática do nome + telefone.",
        tags: ["Fluxo", "Captura", "Telefone"],
        color: "emerald",
        template: QUIZ_LEAD_TEMPLATE,
        recommended: true,
        features: [
            "Perguntas em sequência (quiz)",
            "Validação automática do telefone",
            "Salva nome + telefone no contato",
            "Mensagem de confirmação final",
        ]
    },
    {
        id: "simple_response",
        icon: MessageSquare,
        title: "Resposta Simples",
        description: "Resposta automática por palavra-chave. Ideal para perguntas frequentes como preço, horário, etc.",
        tags: ["Simples", "FAQ"],
        color: "blue",
        template: SIMPLE_RESPONSE_TEMPLATE,
        recommended: false,
        features: [
            "Resposta por palavra-chave",
            "Suporte a botões e links",
            "Ideal para FAQ e respostas rápidas",
        ]
    },
    {
        id: "comment_response",
        icon: FileText,
        title: "Resposta a Comentário",
        description: "Responda automaticamente quando alguém comenta em um post ou reels. Envie DM privada com mais informações.",
        tags: ["Comentário", "Post", "Reels"],
        color: "amber",
        template: COMMENT_TEMPLATE,
        recommended: false,
        features: [
            "Ativa por comentário em post",
            "Envio de DM privada",
            "Cooldown anti-spam (60s)",
        ]
    }
]

const colorMap: Record<string, { bg: string, border: string, text: string, icon: string, glow: string }> = {
    emerald: {
        bg: "bg-emerald-500/5",
        border: "border-emerald-500/20 hover:border-emerald-500/50",
        text: "text-emerald-400",
        icon: "bg-emerald-500/10",
        glow: "shadow-emerald-500/10",
    },
    blue: {
        bg: "bg-blue-500/5",
        border: "border-blue-500/20 hover:border-blue-500/50",
        text: "text-blue-400",
        icon: "bg-blue-500/10",
        glow: "shadow-blue-500/10",
    },
    amber: {
        bg: "bg-amber-500/5",
        border: "border-amber-500/20 hover:border-amber-500/50",
        text: "text-amber-400",
        icon: "bg-amber-500/10",
        glow: "shadow-amber-500/10",
    },
}

export default function CreateRulePage() {
    const [selectedTemplate, setSelectedTemplate] = useState<any>(null)

    // If template selected, show pre-filled editor
    if (selectedTemplate) {
        return <RuleEditor mode="create" rule={selectedTemplate} />
    }

    // Template selection screen
    return (
        <div className="space-y-8 max-w-5xl mx-auto pb-16">
            {/* Header */}
            <div className="flex items-center gap-4 sticky top-0 z-50 bg-background/80 backdrop-blur-lg py-4 border-b border-white/5 -mx-4 px-4 lg:-mx-8 lg:px-8">
                <Link href="/workflows">
                    <Button variant="ghost" size="icon" className="hover:bg-zinc-800 rounded-full">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                        Criar Nova Automação
                    </h1>
                    <p className="text-xs text-zinc-400">Escolha um template para começar ou crie do zero</p>
                </div>
            </div>

            {/* Template Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map((t) => {
                    const colors = colorMap[t.color] || colorMap.blue
                    return (
                        <Card
                            key={t.id}
                            className={`relative cursor-pointer transition-all duration-300 ${colors.bg} border ${colors.border} hover:shadow-xl ${colors.glow} group overflow-hidden`}
                            onClick={() => setSelectedTemplate(t.template)}
                        >
                            {t.recommended && (
                                <div className="absolute top-3 right-3">
                                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] uppercase tracking-wider font-bold animate-pulse">
                                        ⭐ Recomendado
                                    </Badge>
                                </div>
                            )}

                            <CardHeader className="pb-3">
                                <div className={`w-12 h-12 rounded-xl ${colors.icon} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                                    <t.icon className={`w-6 h-6 ${colors.text}`} />
                                </div>
                                <CardTitle className="text-white text-lg">{t.title}</CardTitle>
                                <CardDescription className="text-zinc-400 text-sm leading-relaxed">
                                    {t.description}
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="space-y-4">
                                {/* Features */}
                                <div className="space-y-2">
                                    {t.features.map((f, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <CheckCircle2 className={`w-3.5 h-3.5 ${colors.text} shrink-0`} />
                                            <span className="text-xs text-zinc-400">{f}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Tags */}
                                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/5">
                                    {t.tags.map((tag) => (
                                        <Badge
                                            key={tag}
                                            variant="outline"
                                            className="text-[10px] border-zinc-700/50 text-zinc-500"
                                        >
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>

                                {/* CTA */}
                                <Button
                                    className={`w-full mt-2 border ${colors.border} bg-transparent ${colors.text} hover:bg-white/5 group-hover:translate-x-0 transition-all`}
                                    variant="outline"
                                >
                                    Usar Template
                                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Start from scratch */}
            <div className="text-center pt-4">
                <Button
                    variant="ghost"
                    className="text-zinc-500 hover:text-zinc-300 gap-2"
                    onClick={() => setSelectedTemplate({})}
                >
                    <Zap className="w-4 h-4" />
                    Criar do zero (em branco)
                </Button>
            </div>
        </div>
    )
}
