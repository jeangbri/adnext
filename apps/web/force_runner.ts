import { processBroadcasts } from './src/lib/broadcast-runner';

async function main() {
    console.log('Forcing the runner to execute now...');
    const result = await processBroadcasts();
    console.log('Result:', result);

    // Como processBroadcasts só pega 50 de cada vez, nós podemos rodar de novo em loop até terminar o batch
    if (result.processed > 0) {
        let i = 0; // limit pra nao rodar infinitamente se bugar
        while (i < 10) {
            console.log(`Running batch ${i + 2}...`);
            const res = await processBroadcasts();
            console.log('Processed:', res.processed);
            if (res.processed === 0) break;
            i++;
        }
    }
}

main().catch(e => console.error(e)).finally(() => process.exit(0));
