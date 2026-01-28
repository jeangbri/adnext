import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspace = await getPrimaryWorkspace(user.id, user.email || '');

    // 1. Preco
    await prisma.automationRule.create({
        data: {
            workspaceId: workspace.id,
            name: "Preço e Planos",
            keywords: ["preço", "valor", "custo", "plano"],
            matchType: "CONTAINS",
            priority: 1,
            isActive: true,
            actions: {
                create: {
                    type: "TEXT",
                    payload: { text: "Nossos planos começam a partir de R$ 99,00/mês. Gostaria de saber mais?" },
                    order: 0
                }
            }
        }
    });

    // 2. Endereco
    await prisma.automationRule.create({
        data: {
            workspaceId: workspace.id,
            name: "Localização",
            keywords: ["onde", "endereço", "local", "fica"],
            matchType: "CONTAINS",
            priority: 1,
            isActive: true,
            actions: {
                create: {
                    type: "TEXT",
                    payload: { text: "Estamos localizados na Av. Paulista, 1000. Venha nos visitar!" },
                    order: 0
                }
            }
        }
    });

    // 3. Menu (Botões)
    await prisma.automationRule.create({
        data: {
            workspaceId: workspace.id,
            name: "Menu Principal",
            keywords: ["menu", "opções", "ajuda", "oi", "olá"],
            matchType: "CONTAINS",
            priority: 0, // Lower priority
            isActive: true,
            actions: {
                create: {
                    type: "BUTTON_TEMPLATE",
                    payload: {
                        text: "Como posso ajudar hoje?",
                        buttons: [
                            { type: "web_url", title: "Ver Site", url: "https://adnext.com" },
                            { type: "web_url", title: "Falar no WhatsApp", url: "https://wa.me/5511999999999" }
                        ]
                    },
                    order: 0
                }
            }
        }
    });

    return NextResponse.json({ success: true, message: "Rules seeded" });
}
