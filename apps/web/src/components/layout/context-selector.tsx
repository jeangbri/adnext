"use client"

import { useEffect, useState, useMemo } from "react"
import { useAppStore } from "@/store/context-store"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getProjects } from "@/app/actions/projects"
import { setContext } from "@/app/actions/context"
import { Loader2 } from "lucide-react"

export function ContextSelector() {
    const { selectedProjectId, selectedPageId, setProject, setPage } = useAppStore()
    const [projects, setProjects] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [hydrated, setHydrated] = useState(false)

    useEffect(() => {
        setHydrated(true)
        loadData()
    }, [])

    // Sync function
    const handleProjectChange = async (val: string) => {
        setProject(val)
        await setContext(val, 'ALL')
    }

    const handlePageChange = async (val: string) => {
        setPage(val)
        if (selectedProjectId) {
            await setContext(selectedProjectId, val)
        }
    }

    const loadData = async () => {
        try {
            const data = await getProjects()
            setProjects(data)

            // Auto-select logic could go here if needed
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const currentProject = useMemo(() =>
        projects.find(p => p.id === selectedProjectId),
        [projects, selectedProjectId])

    const relevantPages = currentProject?.pages || []

    if (!hydrated) return null // Prevent mismatch

    return (
        <div className="flex items-center gap-2">
            <Select
                value={selectedProjectId || ""}
                onValueChange={(val) => handleProjectChange(val)}
            >
                <SelectTrigger className="w-[180px] h-9 text-xs font-medium bg-zinc-900/50 border-zinc-800 focus:ring-0 focus:ring-offset-0">
                    <div className="flex items-center gap-2 truncate">
                        <span className="text-muted-foreground">Projeto:</span>
                        <SelectValue placeholder="Selecione..." />
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
                onValueChange={(val) => handlePageChange(val)}
                disabled={!selectedProjectId}
            >
                <SelectTrigger className="w-[180px] h-9 text-xs font-medium bg-zinc-900/50 border-zinc-800 focus:ring-0 focus:ring-offset-0">
                    <div className="flex items-center gap-2 truncate">
                        <span className="text-muted-foreground">Página:</span>
                        <SelectValue placeholder="Todas" />
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
