
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Connecting to database...');
    try {
        const workspaces = await prisma.workspace.findMany();
        console.log(`Found ${workspaces.length} workspaces.`);

        if (workspaces.length === 0) {
            console.error('No workspaces found! Cannot seed automations.');
            return;
        }

        const workspace = workspaces[0];
        console.log(`Seeding automations for workspace: ${workspace.name} (${workspace.id})`);


        // 1. Preco
        await prisma.automationRule.create({
            data: {
                workspaceId: workspace.id,
                name: "Preço e Planos",
                keywords: ["preço", "valor", "custo", "plano", "precos", "valores"],
                matchType: "CONTAINS",
                matchOperator: "ANY",
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
        console.log('- Created "Preço e Planos" rule');

        // 2. Endereco
        await prisma.automationRule.create({
            data: {
                workspaceId: workspace.id,
                name: "Localização",
                keywords: ["onde", "endereço", "local", "fica", "endereco"],
                matchType: "CONTAINS",
                matchOperator: "ANY",
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
        console.log('- Created "Localização" rule');

        // 3. Menu (Botões)
        await prisma.automationRule.create({
            data: {
                workspaceId: workspace.id,
                name: "Menu Principal",
                keywords: ["menu", "opções", "ajuda", "oi", "olá", "ola", "começar", "start"],
                matchType: "CONTAINS",
                matchOperator: "ANY",
                priority: 0,
                isActive: true,
                actions: {
                    create: {
                        type: "BUTTON_TEMPLATE",
                        payload: {
                            text: "Como posso ajudar hoje?",
                            buttons: [
                                { type: "web_url", title: "Ver Site", url: "https://adnext.com" },
                                { type: "web_url", title: "Falar no WhatsApp", url: "https://wa.me/5511999999999" },
                                { type: "postback", title: "Ver Planos", payload: "SHOW_PLANS" }
                            ]
                        },
                        order: 0
                    }
                }
            }
        });
        console.log('- Created "Menu Principal" rule');


        console.log('Seed completed successfully!');

    } catch (e: any) {
        console.error('Error seeding database:');
        console.error('Message:', e.message);
        console.error('Code:', e.code);
        console.error('Meta:', e.meta);
        console.error('Full Error:', JSON.stringify(e, null, 2));
    } finally {
        await prisma.$disconnect();
    }
}

main();
