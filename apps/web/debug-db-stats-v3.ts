
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const pageId = '978744651987190'
    const total = await prisma.contact.count({ where: { pageId } })
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const active = await prisma.contact.count({
        where: {
            pageId,
            lastSeenAt: { gte: cutoff }
        }
    })

    console.log(`Page: ${pageId}`)
    console.log(`Total: ${total}`)
    console.log(`Active (gte ${cutoff.toISOString()}): ${active}`)

    // Check latest interaction times for non-active users
    const latest = await prisma.contact.findMany({
        where: { pageId },
        orderBy: { lastSeenAt: 'desc' },
        take: 10,
        select: { firstName: true, lastSeenAt: true }
    })
    console.log('Latest 10 contacts:', JSON.stringify(latest, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
