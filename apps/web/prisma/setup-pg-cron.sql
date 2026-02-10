-- ============================================================
-- SETUP: pg_cron + pg_net for ScheduledExecution sweep
-- Execute this in your Supabase SQL Editor (Dashboard)
-- This creates a cron job that runs every minute to process
-- pending delayed executions via the runner-sweep API
-- ============================================================

-- 1. Enable extensions (safe to run multiple times)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Create the cron job that calls runner-sweep every minute
-- Replace the RUNNER_SECRET below with your actual RUNNER_SECRET env value
SELECT cron.schedule(
    'sweep-pending-executions',    -- job name
    '* * * * *',                   -- every minute
    $$
    SELECT net.http_post(
        url := 'https://adnext-web.vercel.app/api/messenger/runner-sweep',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || '46GYApzjM4VFHp3GpdPYb4aE7ZuuFdnP'
        ),
        body := '{}'::jsonb
    ) AS request_id;
    $$
);

-- 3. Verify the job was created
SELECT * FROM cron.job;

-- ============================================================
-- To REMOVE the cron job later:
-- SELECT cron.unschedule('sweep-pending-executions');
-- 
-- To check execution history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
-- ============================================================
