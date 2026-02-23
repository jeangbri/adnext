
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    // @ts-ignore
    const events = await prisma.messageEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10
    })

    console.log('--- LATEST MESSAGE EVENTS (New Architecture) ---')
    events.forEach(e => {
        // @ts-ignore
        console.log(`[${e.createdAt.toISOString()}] ${e.direction} | PSID: ${e.psid} | Source: ${e.source}`)
    })

    // @ts-ignore
    const count = await prisma.messageEvent.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } }
    })
    console.log(`\nEvents in the last 30 minutes: ${count}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
