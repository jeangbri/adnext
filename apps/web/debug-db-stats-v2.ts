
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const pageId = '978744651987190'
    const total = await prisma.contact.count({ where: { pageId } })
    const withLastSeen = await prisma.contact.count({ where: { pageId, lastSeenAt: { not: null } } })
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const active = await prisma.contact.count({ where: { pageId, lastSeenAt: { gte: cutoff } } })

    console.log(`Page: ${pageId}`)
    console.log(`Total: ${total}`)
    console.log(`With LastSeenAt: ${withLastSeen}`)
    console.log(`Active (24h): ${active}`)

    // Check conversation states to see if more than 2 interacted
    try {
        const conversations = await (prisma as any).conversation.findMany({
            where: { pageId, lastInteractionAt: { gte: cutoff } },
            take: 50
        })
        console.log(`Recent Conversations (24h): ${conversations.length}`)
    } catch (e) { }
}

main().catch(console.error).finally(() => prisma.$disconnect())
