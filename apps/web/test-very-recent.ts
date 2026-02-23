
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const logs = await prisma.messageLog.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } },
        orderBy: { createdAt: 'desc' }
    })

    console.log(`--- RECENT LOGS (Last 30m): ${logs.length} ---`)
    logs.forEach(log => {
        console.log(`[${log.createdAt.toISOString()}] ${log.direction} | PSID: ${log.contactId} | Status: ${log.status} | Text: ${log.incomingText}`)
    })
}

main().catch(console.error).finally(() => prisma.$disconnect())
