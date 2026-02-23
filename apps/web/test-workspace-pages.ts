
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const workspaceId = '7682b340-1b0d-4655-8dca-5867c0d33975'
    const pages = await prisma.messengerPage.findMany({
        where: { workspaceId, isActive: true }
    })
    console.log('Active Pages in Workspace:', pages.map(p => `${p.pageName} (${p.pageId})`))
}

main().catch(console.error).finally(() => prisma.$disconnect())
