
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    try {
        const funcs: any = await prisma.$queryRawUnsafe(`
            SELECT proname, nspname 
            FROM pg_proc p 
            JOIN pg_namespace n ON p.pronamespace = n.oid 
            WHERE nspname = 'net'
        `)
        console.log('Functions in "net" schema:', JSON.stringify(funcs, null, 2))
    } catch (e: any) {
        console.error('Failed:', e.message)
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
