"use client"

import { useEffect, useState, useMemo, useCallback, useTransition } from "react"
import { useAppStore } from "@/store/context-store"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getProjects } from "@/app/actions/projects"
import { setContext } from "@/app/actions/context"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

export function ContextSelector() {
    const { selectedProjectId, selectedPageId, setProject, setPage } = useAppStore()
    const [projects, setProjects] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [hydrated, setHydrated] = useState(false)
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    useEffect(() => {
        setHydrated(true)
        loadData()
    }, [])

    const loadData = useCallback(async () => {
        try {
            const data = await getProjects()
            setProjects(data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }, [])

    const handleProjectChange = useCallback(async (val: string) => {
        setProject(val)
        await setContext(val, 'ALL')
        startTransition(() => {
            router.refresh()
        })
    }, [setProject, router])

    const handlePageChange = useCallback(async (val: string) => {
        setPage(val)
        if (selectedProjectId) {
            await setContext(selectedProjectId, val)
            startTransition(() => {
                router.refresh()
            })
        }
    }, [setPage, selectedProjectId, router])

    const currentProject = useMemo(() =>
        projects.find(p => p.id === selectedProjectId),
        [projects, selectedProjectId])

    const relevantPages = currentProject?.pages || []

    if (!hydrated) return null

    return (
        <div className="flex items-center gap-2">
            <Select
                value={selectedProjectId || ""}
                onValueChange={handleProjectChange}
                disabled={isPending}
            >
                <SelectTrigger className="w-[180px] h-9 text-xs font-medium bg-zinc-900/50 border-zinc-800 focus:ring-0 focus:ring-offset-0">
                    <div className="flex items-center gap-2 truncate">
                        <span className="text-muted-foreground">Projeto:</span>
                        {isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        ) : (
                            <SelectValue placeholder="Selecione..." />
                        )}
                    </div>
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                    {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                    {projects.length === 0 && (
                        <div className="p-2 text-xs text-zinc-500 text-center">Nenhum projeto</div>
                    )}
                </SelectContent>
            </Select>

            <Select
                value={selectedPageId || "ALL"}
                onValueChange={handlePageChange}
                disabled={!selectedProjectId || isPending}
            >
                <SelectTrigger className="w-[180px] h-9 text-xs font-medium bg-zinc-900/50 border-zinc-800 focus:ring-0 focus:ring-offset-0">
                    <div className="flex items-center gap-2 truncate">
                        <span className="text-muted-foreground">Página:</span>
                        {isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        ) : (
                            <SelectValue placeholder="Todas" />
                        )}
                    </div>
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                    <SelectItem value="ALL" className="font-semibold text-primary">Todas as Páginas</SelectItem>
                    {relevantPages.map((page: any) => (
                        <SelectItem key={page.pageId} value={page.pageId}>{page.pageName}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
