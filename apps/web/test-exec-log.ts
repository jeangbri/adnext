
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

    console.log(`Execution details:`, JSON.stringify(exec, null, 2))

    if (exec.refLogId) {
        const log = await prisma.messageLog.findUnique({
            where: { id: exec.refLogId }
        })
        console.log(`Log details:`, JSON.stringify(log, null, 2))
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
