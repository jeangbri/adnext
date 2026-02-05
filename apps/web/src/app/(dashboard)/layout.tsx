import { ContextSelector } from "@/components/layout/context-selector"
import { Sidebar } from "@/components/layout/sidebar"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // In a real app we'd check session here server-side
    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <Sidebar />
            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                <header className="flex h-16 items-center border-b border-zinc-800 bg-zinc-950/50 px-6">
                    <ContextSelector />
                </header>
                <div className="flex-1 overflow-y-auto">
                    <div className="container mx-auto p-8">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    )
}
