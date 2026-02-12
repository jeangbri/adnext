import { Skeleton } from "@/components/ui/skeleton"

export default function WorkflowsLoading() {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-36 bg-zinc-800" />
                    <Skeleton className="h-4 w-80 bg-zinc-800/60" />
                </div>
                <Skeleton className="h-10 w-32 bg-zinc-800 rounded-md" />
            </div>

            {/* Table */}
            <div className="border border-white/10 rounded-lg bg-zinc-950/50 overflow-hidden">
                {/* Table Header */}
                <div className="bg-zinc-900/50 border-b border-white/5 px-6 py-4 flex gap-8">
                    {["w-20", "w-32", "w-16", "w-12", "w-16", "w-16"].map((w, i) => (
                        <Skeleton key={i} className={`h-4 ${w} bg-zinc-800`} />
                    ))}
                </div>
                {/* Table Rows */}
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="px-6 py-4 flex items-center gap-8 border-b border-white/5 last:border-0">
                        <Skeleton className="h-4 w-28 bg-zinc-800" />
                        <div className="flex gap-1.5">
                            <Skeleton className="h-5 w-14 rounded-full bg-zinc-800" />
                            <Skeleton className="h-5 w-18 rounded-full bg-zinc-800" />
                        </div>
                        <Skeleton className="h-4 w-8 bg-zinc-800" />
                        <Skeleton className="h-4 w-16 bg-zinc-800" />
                        <Skeleton className="h-5 w-14 rounded-full bg-zinc-800" />
                        <div className="ml-auto flex gap-2">
                            <Skeleton className="h-8 w-8 rounded bg-zinc-800" />
                            <Skeleton className="h-8 w-8 rounded bg-zinc-800" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
