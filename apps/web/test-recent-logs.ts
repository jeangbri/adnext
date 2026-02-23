
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const logs = await prisma.messageLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
            id: true,
            status: true,
            createdAt: true,
            pageId: true,
            direction: true,
            incomingText: true
        }
    })

    console.log('--- LATEST MESSAGE LOGS ---')
    logs.forEach(log => {
        console.log(`[${log.createdAt.toISOString()}] ${log.direction} | Page: ${log.pageId} | Status: ${log.status} | Text: ${log.incomingText || 'N/A'}`)
    })

    const count = await prisma.messageLog.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } }
    })
    console.log(`\nLogs in the last 30 minutes: ${count}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
