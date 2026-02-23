
import { PrismaClient } from '@prisma/client'
import { decrypt } from './src/lib/encryption'
const prisma = new PrismaClient()

async function main() {
    const pageId = '978744651987190' // The one from previous logs
    const page = await prisma.messengerPage.findUnique({
        where: { pageId }
    })

    if (!page) {
        console.log('Page not found')
        return
    }

    console.log(`Page: ${page.pageName} (${page.pageId})`)
    const token = decrypt(page.pageAccessToken)
    console.log(`Token start: ${token.substring(0, 10)}...`)

    // Try to validate token via Meta API
    try {
        const res = await fetch(`https://graph.facebook.com/debug_token?input_token=${token}&access_token=${token}`)
        const data = await res.json()
        console.log('Token Debug Info:', JSON.stringify(data, null, 2))
    } catch (e: any) {
        console.error('Failed to debug token:', e.message)
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
