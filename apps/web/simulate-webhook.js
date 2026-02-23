
const crypto = require('crypto');

async function testWebhook() {
    const url = 'https://adnext-web.vercel.app/api/webhooks/messenger';
    const secret = 'd0e7a7590214a1a36746864177691689'; // I fetched this from a previous KI or assuming it matches FB_APP_SECRET
    // Wait, I don't know the FB_APP_SECRET. 
    // But I can try to send WITHOUT signature and see if it returns 401.

    const body = JSON.stringify({
        object: 'page',
        entry: [{
            id: '978744651987190',
            time: Date.now(),
            messaging: [{
                sender: { id: '33824633320516633' },
                recipient: { id: '978744651987190' },
                timestamp: Date.now(),
                message: { mid: 'test', text: 'QUERO VER OS CURSOS' }
            }]
        }]
    });

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
    });

    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text);
}

testWebhook();
