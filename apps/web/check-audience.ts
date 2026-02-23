
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const pageId = '978744651987190'
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const activeContacts = await prisma.contact.count({
        where: {
            pageId: pageId,
            lastSeenAt: { gte: twentyFourHoursAgo }
        }
    })

    console.log(`Contacts with lastSeenAt in the last 24h for page ${pageId}: ${activeContacts}`)

    // Check conversations as well if the engine uses that
    try {
        const activeConversations = await (prisma as any).conversation.count({
            where: {
                pageId: pageId,
                lastInteractionAt: { gte: twentyFourHoursAgo }
            }
        })
        console.log(`Conversations with lastInteractionAt in the last 24h: ${activeConversations}`)
    } catch (e) {
        console.log('Conversation table check failed or missing Interaction field')
    }

    // List a few active ones to verify data
    const list = await prisma.contact.findMany({
        where: {
            pageId: pageId,
            lastSeenAt: { gte: twentyFourHoursAgo }
        },
        take: 5,
        select: { id: true, firstName: true, lastSeenAt: true }
    })
    console.log('Sample Active Contacts:', JSON.stringify(list, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
