
async function main() {
    console.log('FB_APP_SECRET defined:', !!process.env.FB_APP_SECRET);
    console.log('FB_APP_ID defined:', !!process.env.FB_APP_ID);
    console.log('FB_MESSENGER_VERIFY_TOKEN defined:', !!process.env.FB_MESSENGER_VERIFY_TOKEN);
    console.log('APP_URL defined:', !!process.env.APP_URL);
}
main();
