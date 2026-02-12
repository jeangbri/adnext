import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function SettingsLoading() {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="space-y-2">
                <Skeleton className="h-9 w-40 bg-zinc-800" />
                <Skeleton className="h-4 w-80 bg-zinc-800/60" />
            </div>

            <Card className="border-zinc-800 bg-zinc-900/50">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-12 w-12 rounded-xl bg-zinc-800" />
                            <div className="space-y-1.5">
                                <Skeleton className="h-5 w-48 bg-zinc-800" />
                                <Skeleton className="h-4 w-64 bg-zinc-800/60" />
                            </div>
                        </div>
                        <Skeleton className="h-6 w-24 rounded-full bg-zinc-800" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {Array.from({ length: 2 }).map((_, i) => (
                            <div key={i} className="rounded-xl border border-zinc-800 p-4 bg-black/20 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <Skeleton className="w-12 h-12 rounded-full bg-zinc-800" />
                                    <div className="space-y-1.5">
                                        <Skeleton className="h-5 w-40 bg-zinc-800" />
                                        <Skeleton className="h-3 w-24 bg-zinc-800/60" />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Skeleton className="h-8 w-28 rounded bg-zinc-800" />
                                    <Skeleton className="h-8 w-28 rounded bg-zinc-800" />
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
