import { Skeleton } from "@/components/ui/skeleton"

export default function ProjectsLoading() {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="space-y-2">
                <Skeleton className="h-9 w-44 bg-zinc-800" />
                <Skeleton className="h-4 w-80 bg-zinc-800/60" />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-6 w-32 bg-zinc-800" />
                            <Skeleton className="h-5 w-12 rounded-full bg-zinc-800" />
                        </div>
                        <Skeleton className="h-4 w-48 bg-zinc-800/60" />
                        <div className="flex gap-2">
                            <Skeleton className="h-8 w-20 rounded bg-zinc-800" />
                            <Skeleton className="h-8 w-20 rounded bg-zinc-800" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
