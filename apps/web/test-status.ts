
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const logs = await prisma.messageLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
            id: true,
            status: true,
            createdAt: true,
            error: true,
            pageId: true,
            direction: true,
            incomingText: true
        }
    })

    console.log('--- LATEST MESSAGE LOGS ---')
    logs.forEach(log => {
        console.log(`[${log.createdAt.toISOString()}] Direction: ${log.direction} | Status: ${log.status} | Page: ${log.pageId} | Text: ${log.incomingText || 'N/A'}`)
        if (log.error) console.log(`   ERROR: ${log.error}`)
    })

    const runs = await prisma.ruleExecution.findMany({
        orderBy: { lastExecutedAt: 'desc' },
        take: 5,
        include: {
            rule: { select: { name: true } }
        }
    })

    console.log('\n--- LATEST RULE EXECUTIONS ---')
    runs.forEach(run => {
        console.log(`[${run.lastExecutedAt.toISOString()}] Rule: ${run.rule?.name}`)
    })

    const failedExecs = await prisma.scheduledExecution.findMany({
        where: { lastError: { not: null } },
        orderBy: { updatedAt: 'desc' },
        take: 5
    })
    console.log('\n--- LATEST FAILED EXECUTIONS ---')
    failedExecs.forEach(e => {
        console.log(`[${e.updatedAt.toISOString()}] ID: ${e.id} | Error: ${e.lastError}`)
    })

    const processing = await prisma.scheduledExecution.count({
        where: { status: 'PROCESSING' }
    })
    console.log(`\nPROCESSING SCHEDULED EXECUTIONS: ${processing}`)

    const pending = await prisma.scheduledExecution.count({
        where: { status: 'PENDING' }
    })
    console.log(`PENDING SCHEDULED EXECUTIONS: ${pending}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
