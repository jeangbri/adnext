import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function BroadcastLoading() {
    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-9 w-36 bg-zinc-800" />
                    <Skeleton className="h-4 w-72 bg-zinc-800/60" />
                </div>
                <Skeleton className="h-10 w-36 bg-zinc-800 rounded-md" />
            </div>

            <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                    <Skeleton className="h-6 w-44 bg-zinc-800" />
                    <Skeleton className="h-4 w-52 bg-zinc-800/60" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
                                <div className="flex items-center gap-4">
                                    <Skeleton className="w-10 h-10 rounded-full bg-zinc-800" />
                                    <div className="space-y-1.5">
                                        <Skeleton className="h-4 w-40 bg-zinc-800" />
                                        <Skeleton className="h-3 w-56 bg-zinc-800/60" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <Skeleton className="h-4 w-16 bg-zinc-800" />
                                    <Skeleton className="h-5 w-20 rounded-full bg-zinc-800" />
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
