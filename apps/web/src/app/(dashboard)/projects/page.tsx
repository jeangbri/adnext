"use client"

import { useEffect, useState, useCallback } from "react"
import { getProjects } from "@/app/actions/projects"
import { ProjectList } from "@/components/projects/project-list"
import { Skeleton } from "@/components/ui/skeleton"

export default function ProjectsPage() {
    const [projects, setProjects] = useState<any[] | null>(null)
    const [loading, setLoading] = useState(true)

    const loadProjects = useCallback(async () => {
        try {
            const data = await getProjects()
            setProjects(data)
        } catch (e) {
            console.error("Failed to load projects", e)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadProjects()
    }, [loadProjects])

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-white focus:outline-none">Meus Projetos</h2>
                <p className="text-zinc-400">Gerencie seus sites e clientes para organizar suas automações.</p>
            </div>

            {loading ? (
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
            ) : (
                <ProjectList initialProjects={projects || []} />
            )}
        </div>
    )
}
