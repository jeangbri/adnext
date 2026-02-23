
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const psid = '25672966959052855' // PSID from previous specific rule test
    const logs = await prisma.messageLog.findMany({
        where: { contact: { psid } },
        orderBy: { createdAt: 'desc' },
        take: 20
    })

    console.log(`--- LOGS FOR PSID ${psid} ---`)
    logs.forEach(l => {
        console.log(`[${l.createdAt.toISOString()}] Status: ${l.status} | Direction: ${l.direction} | Error: ${l.error}`)
    })
}

main().catch(console.error).finally(() => prisma.$disconnect())
