
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    // Reset items stuck in PROCESSING for more than 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    const res = await prisma.scheduledExecution.updateMany({
        where: {
            status: 'PROCESSING',
            updatedAt: { lt: fiveMinAgo }
        },
        data: {
            status: 'PENDING'
        }
    })
    console.log(`Reset ${res.count} stuck executions back to PENDING`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
