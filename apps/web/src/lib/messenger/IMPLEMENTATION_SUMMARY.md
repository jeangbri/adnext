
# Messenger Advanced Features Implementation

The system has been updated with:

1. **Policy Engine**: `classifyMessageType()` determines if messages are `RESPONSE_24H` or `UTILITY`.
2. **Template System**: `buildTemplateByPolicy()` constructs complaint templates (Utility/FollowUp/Reminder).
3. **Async Delays**: `delayQueue` uses Redis ZSET for high-performance scheduling.
4. **Automation Runner**: `/api/messenger/runner` processes delay queue and executes next steps.
5. **Smart Broadcast**: Legacy Broadcast Runner updated to check policy and auto-convert to Utility Template if needed.
6. **Smart Automations**: `messenger-service.ts` updated to block non-compliant messages or convert to templates automatically.

## Next Steps

1. Configure `.env`:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `CRON_SECRET` (optional)

2. Trigger Runner:
   - Set up a cron job (e.g., Vercel Cron or external) to call `GET /api/messenger/runner` every minute.

3. Verify Broadcasts:
   - Create a broadcast with "24h Only" -> Should skip outside 24h.
   - Create a broadcast with "Tagged" -> Should send as Utility outside 24h.
   - Smart Conversion is enabled in code logic (defaulting to ACCOUNT_UPDATE tag if needed).

## Tests
- Run `npx jest src/lib/messenger/messenger.test.ts` to verify logic.
