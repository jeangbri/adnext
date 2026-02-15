
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Connecting to database...');
    try {
        const users = await prisma.user.count();
        console.log(`Found ${users} Users.`);

        const workspaces = await prisma.workspace.count();
        console.log(`Found ${workspaces} Workspaces.`);

        const pages = await prisma.messengerPage.count();
        console.log(`Found ${pages} MessengerPages.`);

        const rules = await prisma.automationRule.count();
        console.log(`Found ${rules} AutomationRules.`);

    } catch (e) {
        console.error('Error querying database:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
