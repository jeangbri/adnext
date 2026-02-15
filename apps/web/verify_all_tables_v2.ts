
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
            SELECT tablename 
            FROM pg_catalog.pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        `;

        if (!tables.length) {
            console.log('No tables found in public schema.');
            return;
        }

        console.log('Tables found:');
        for (const t of tables) {
            try {
                // Using unsafe query to count rows for any table name
                const result: any = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as c FROM "${t.tablename}"`);
                // result is usually [{ c: BigInt/Number }]
                const count = result[0]?.c;
                console.log(`- ${t.tablename}: ${Number(count)} rows`);
            } catch (err: any) {
                console.log(`- ${t.tablename}: [Error counting: ${err.message}]`);
            }
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
