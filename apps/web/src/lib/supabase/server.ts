import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
    const cookieStore = cookies()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // Safe fallback for build time / missing envs to allow static generation to proceed
    if (!supabaseUrl || !supabaseKey) {
        console.warn("⚠️ Missing Supabase environment variables. Using fallback for build.");
        // Return a dummy client or valid client with placeholder credentials if needed
        // But createServerClient requires valid URL format usually.
        // Let's use placeholders, requests will fail but build might pass if not fetching data.
        if (process.env.npm_lifecycle_event === 'build' || !supabaseUrl) {
            return createServerClient(
                supabaseUrl || 'https://placeholder.supabase.co',
                supabaseKey || 'placeholder',
                { cookies: { get: () => undefined, set: () => { }, remove: () => { } } }
            );
        }
    }

    return createServerClient(
        supabaseUrl || '',
        supabaseKey || '',
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value, ...options })
                    } catch (error) {
                        // The `set` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
                remove(name: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value: '', ...options })
                    } catch (error) {
                        // The `delete` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    )
}
