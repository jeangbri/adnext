
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const ruleId = '593d7ace-9c3e-4577-aced-5ddc2fd88179'
    const rule = await prisma.automationRule.findUnique({
        where: { id: ruleId },
        include: { actions: { orderBy: { order: 'asc' } } }
    })

    if (!rule) {
        console.log('Rule not found')
        return
    }

    console.log(`Rule: ${rule.name}`)
    rule.actions.forEach((a, i) => {
        console.log(`${i}: ${a.type} | Delay: ${a.delayMs}ms`)
    })
}

main().catch(console.error).finally(() => prisma.$disconnect())
