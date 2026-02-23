
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const ruleId = '593d7ace-9c3e-4577-aced-5ddc2fd88179'

    // We update the rule to:
    // 1. Remove pageIds (making it apply to all pages in workspace)
    // 2. Change matchType to CONTAINS for better reliability
    await prisma.automationRule.update({
        where: { id: ruleId },
        data: {
            pageIds: [], // Empty means across all pages in our code's logic (checkPageScope)
            matchType: 'CONTAINS'
        }
    })

    console.log('Rule "Welcome" updated for maximum reliability and reach.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
