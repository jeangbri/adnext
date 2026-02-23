
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const rule = await prisma.automationRule.findFirst({
        where: { name: 'Welcome' },
        include: { actions: true }
    })

    if (!rule) {
        console.log('Rule "Welcome" not found')
        return
    }

    console.log('--- RULE DETAILS ---')
    console.log(JSON.stringify({
        id: rule.id,
        name: rule.name,
        triggerType: rule.triggerType,
        keywords: rule.keywords,
        isActive: rule.isActive,
        pageIds: rule.pageIds,
        cooldownSeconds: rule.cooldownSeconds,
        matchType: rule.matchType,
        matchOperator: rule.matchOperator,
        priority: rule.priority
    }, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
