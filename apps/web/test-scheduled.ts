
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    console.log('--- RECENT SCHEDULED EXECUTIONS ---')
    const execs = await prisma.scheduledExecution.findMany({
        orderBy: { runAt: 'asc' },
        where: { status: 'PENDING' },
        take: 10
    })

    execs.forEach(e => {
        console.log(`[${e.updatedAt.toISOString()}] ID: ${e.id} | Status: ${e.status} | RunAt: ${e.runAt.toISOString()} | Attempts: ${e.attempts} | Error: ${e.lastError || 'None'}`)
    })

    const due = await prisma.scheduledExecution.count({
        where: {
            status: 'PENDING',
            runAt: { lte: new Date() }
        }
    })
    console.log(`\nDUE EXECUTIONS (PENDING & runAt <= Now): ${due}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
