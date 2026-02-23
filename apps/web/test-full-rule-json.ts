
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const rule = await prisma.automationRule.findFirst({
        where: { name: 'Welcome' }
    })

    if (!rule) return;

    console.log('Full Rule JSON:', JSON.stringify(rule, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
