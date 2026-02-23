
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const runId = 'f82fe6f6-aba6-4fcd-885a-c86dbf308e38'
    const exec = await prisma.scheduledExecution.findUnique({
        where: { id: runId }
    })

    if (!exec) {
        console.log('Execution not found')
        return
    }

    const rule = await prisma.automationRule.findUnique({
        where: { id: exec.ruleId },
        include: { actions: { orderBy: { order: 'asc' } } }
    })

    console.log(`Rule: ${rule?.name}`)
    console.log(`Action 12 type: ${rule?.actions[12]?.type}`)
    console.log(`Action 12 payload: ${JSON.stringify(rule?.actions[12]?.payload)}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
