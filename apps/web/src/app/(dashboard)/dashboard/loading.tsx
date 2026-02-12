import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function DashboardLoading() {
    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-9 w-40 bg-zinc-800" />
                    <Skeleton className="h-4 w-64 bg-zinc-800/60" />
                </div>
                <Skeleton className="h-10 w-[200px] bg-zinc-800" />
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i} className="bg-zinc-900/50 border-zinc-800">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <Skeleton className="h-4 w-32 bg-zinc-800" />
                            <Skeleton className="h-4 w-4 rounded bg-zinc-800" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-8 w-16 bg-zinc-800" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Charts */}
            <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
                <Card className="md:col-span-4 lg:col-span-4 bg-zinc-900/50 border-zinc-800">
                    <CardHeader>
                        <Skeleton className="h-6 w-32 bg-zinc-800" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-[200px] w-full bg-zinc-800/40 rounded" />
                    </CardContent>
                </Card>
                <Card className="md:col-span-4 lg:col-span-4 bg-zinc-900/50 border-zinc-800">
                    <CardHeader>
                        <Skeleton className="h-6 w-40 bg-zinc-800" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-[200px] w-full bg-zinc-800/40 rounded" />
                    </CardContent>
                </Card>
            </div>

            {/* Activity */}
            <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                    <Skeleton className="h-6 w-40 bg-zinc-800" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4">
                                <Skeleton className="h-4 w-4 rounded-full bg-zinc-800" />
                                <div className="space-y-1.5 flex-1">
                                    <Skeleton className="h-4 w-48 bg-zinc-800" />
                                    <Skeleton className="h-3 w-24 bg-zinc-800/60" />
                                </div>
                                <Skeleton className="h-4 w-20 bg-zinc-800" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
