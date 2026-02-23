
import { processBroadcasts } from './src/lib/broadcast-runner';
import dotenv from 'dotenv';
dotenv.config();

async function m() {
    console.log('Starting broadcast runner with env check...');
    console.log('Key Length:', process.env.APP_ENCRYPTION_KEY?.length);
    const res = await processBroadcasts();
    console.log('Result:', JSON.stringify(res, null, 2));
}

m().catch(console.error);
