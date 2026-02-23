
import fetch from 'node-fetch';

async function testSweep() {
    const url = 'https://adnext-web.vercel.app/api/messenger/runner-sweep';
    const secret = '46GYApzjM4VFHp3GpdPYb4aE7ZuuFdnP';

    console.log(`Calling sweep at ${url}...`);

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${secret}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        const status = res.status;
        const text = await res.text();

        console.log(`Status: ${status}`);
        console.log(`Response: ${text}`);
    } catch (e: any) {
        console.error(`Error: ${e.message}`);
    }
}

testSweep();
