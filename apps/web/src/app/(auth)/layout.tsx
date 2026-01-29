import { AuthBackground } from '@/components/auth/auth-background'

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="relative flex min-h-screen items-center justify-center bg-black p-4 selection:bg-primary/30 overflow-hidden text-foreground">
            <AuthBackground />

            <div className="relative z-10 w-full max-w-[420px] space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                {children}
            </div>

            {/* Subtle Grid Texture */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 pointer-events-none"></div>
        </div>
    )
}
