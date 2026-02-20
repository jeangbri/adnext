import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const templates = await prisma.messengerTemplate.findMany();
    console.log("Templates: ", templates);
}
main().catch(console.error).finally(() => prisma.$disconnect());
