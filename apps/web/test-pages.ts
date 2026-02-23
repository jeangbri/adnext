
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const pages = await prisma.messengerPage.findMany({
        select: {
            id: true,
            pageId: true,
            pageName: true,
            isActive: true,
            updatedAt: true
        }
    })
    console.log('--- CONNECTED PAGES ---')
    console.log(JSON.stringify(pages, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
