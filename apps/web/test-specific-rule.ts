
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const ruleId = '593d7ace-9c3e-4577-aced-5ddc2fd88179'
    const pending = await prisma.scheduledExecution.findMany({
        where: { ruleId, status: 'PENDING' },
        orderBy: { runAt: 'asc' },
        take: 5
    })

    console.log(`--- PENDING FOR RULE ${ruleId} ---`)
    console.log(JSON.stringify(pending, null, 2))

    const rule = await prisma.automationRule.findUnique({
        where: { id: ruleId },
        include: { actions: true }
    })
    console.log(`\n--- RULE DETAILS ---`)
    console.log(`Name: ${rule?.name} | Active: ${rule?.isActive} | PageId: ${rule?.pageId}`)
    console.log(`Actions Count: ${rule?.actions.length}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
