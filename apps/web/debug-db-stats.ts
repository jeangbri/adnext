
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const pageId = '978744651987190'
    const total = await prisma.contact.count({ where: { pageId } })
    const withLastSeen = await prisma.contact.count({ where: { pageId, lastSeenAt: { not: null } } })
    const 24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const active = await prisma.contact.count({ where: { pageId, lastSeenAt: { gte: 24h } } })

    console.log(`Page: ${pageId}`)
    console.log(`Total: ${total}`)
    console.log(`With LastSeenAt: ${withLastSeen}`)
    console.log(`Active (24h): ${active}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
