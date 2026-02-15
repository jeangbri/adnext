
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Connecting to database...');
    try {
        const rules = await prisma.automationRule.findMany({
            take: 10,
            include: {
                workspace: true
            }
        });

        console.log(`Found ${rules.length} rules.`);
        if (rules.length > 0) {
            console.log('Sample rules:', JSON.stringify(rules.slice(0, 3), null, 2));
        } else {
            console.log('No automation rules found.');
        }

        const workspaces = await prisma.workspace.findMany();
        console.log(`Found ${workspaces.length} workspaces.`);
        workspaces.forEach(w => console.log(`Workspace: ${w.id} - ${w.name}`));

    } catch (e) {
        console.error('Error querying database:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
