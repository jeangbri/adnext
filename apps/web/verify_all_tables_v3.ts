
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Fetching table list...");
        const tables: any[] = await prisma.$queryRaw`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `;

        if (!tables.length) {
            console.log('No tables found in public schema.');
            return;
        }

        console.log(`Found ${tables.length} tables. checking counts...`);
        for (const t of tables) {
            const name = t.table_name;
            try {
                // Using unsafe query to count rows for any table name
                const result: any = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as c FROM "${name}"`);
                // result is usually [{ c: BigInt/Number }]
                const count = result[0]?.c;
                console.log(`- ${name}: ${Number(count)} rows`);
            } catch (err: any) {
                console.log(`- ${name}: [Error counting: ${err.message}]`);
            }
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
