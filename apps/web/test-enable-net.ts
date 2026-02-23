
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    try {
        console.log('Attempting to enable pg_net...')
        await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS pg_net;')
        console.log('Successfully called CREATE EXTENSION pg_net')

        const exts: any = await prisma.$queryRawUnsafe(`SELECT extname FROM pg_extension`)
        console.log('Installed extensions:', JSON.stringify(exts, null, 2))
    } catch (e: any) {
        console.error('Failed:', e.message)
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
