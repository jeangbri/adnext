import { Skeleton } from "@/components/ui/skeleton"

export default function LogsLoading() {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-44 bg-zinc-800" />
                    <Skeleton className="h-4 w-72 bg-zinc-800/60" />
                </div>
            </div>

            <div className="border border-white/10 rounded-lg bg-zinc-950/50 overflow-hidden">
                <div className="bg-zinc-900/50 border-b border-white/5 px-6 py-4 flex gap-8">
                    {["w-24", "w-20", "w-20", "w-20", "w-40", "w-16"].map((w, i) => (
                        <Skeleton key={i} className={`h-4 ${w} bg-zinc-800`} />
                    ))}
                </div>
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="px-6 py-4 flex items-center gap-8 border-b border-white/5 last:border-0">
                        <Skeleton className="h-3 w-28 bg-zinc-800" />
                        <Skeleton className="h-3 w-20 bg-zinc-800" />
                        <Skeleton className="h-3 w-24 bg-zinc-800" />
                        <Skeleton className="h-5 w-24 rounded-full bg-zinc-800" />
                        <Skeleton className="h-3 w-40 bg-zinc-800" />
                        <Skeleton className="h-5 w-16 rounded-full bg-zinc-800" />
                    </div>
                ))}
            </div>
        </div>
    )
}
