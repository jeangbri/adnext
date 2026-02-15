
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const tables: any[] = await prisma.$queryRaw`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `;

        console.log(`Checking ${tables.length} tables...`);
        const nonEmptyTables = [];

        for (const t of tables) {
            const name = t.table_name;
            try {
                const result: any = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as c FROM "${name}"`);
                const count = Number(result[0]?.c);
                if (count > 0) {
                    nonEmptyTables.push({ name, count });
                }
            } catch (err: any) {
                // ignore errors
            }
        }

        console.log('--- NON-EMPTY TABLES ---');
        nonEmptyTables.forEach(t => console.log(`${t.name}: ${t.count}`));
        console.log('------------------------');

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
