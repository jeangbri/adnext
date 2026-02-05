"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, Folder, ExternalLink } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { createProject, deleteProject } from "@/app/actions/projects"
import { useRouter } from "next/navigation"
import { useAppStore } from "@/store/context-store"
import { setContext } from "@/app/actions/context"

interface Project {
    id: string
    name: string
    slug: string | null
    createdAt: Date
    _count: {
        pages: number
    }
}

export function ProjectList({ initialProjects }: { initialProjects: Project[] }) {
    const [projects, setProjects] = useState(initialProjects)
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    async function handleCreate(formData: FormData) {
        setLoading(true)
        const res = await createProject(formData)
        setLoading(false)
        if (res.error) {
            toast.error(res.error)
        } else {
            setIsOpen(false)
            toast.success("Projeto criado!")
            router.refresh()
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Tem certeza que deseja deletar este projeto?")) return
        try {
            await deleteProject(id)
            toast.success("Projeto removido")
            router.refresh()
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    async function handleOpenDashboard(projectId: string) {
        try {
            // Client side update
            useAppStore.getState().setProject(projectId)

            // Server side sync
            await setContext(projectId, 'ALL')

            toast.success("Projeto selecionado!")
            router.push('/dashboard')
        } catch (e) {
            console.error(e)
            toast.error("Erro ao abrir dashboard")
        }
    }

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Create Card */}
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Card className="border-dashed border-2 border-zinc-800 bg-transparent hover:bg-zinc-900/50 transition-colors cursor-pointer flex flex-col items-center justify-center h-[200px] gap-4">
                            <div className="h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center">
                                <Plus className="h-6 w-6 text-zinc-400" />
                            </div>
                            <p className="font-medium text-zinc-400">Criar Novo Projeto</p>
                        </Card>
                    </DialogTrigger>
                    <DialogContent className="bg-zinc-950 border-zinc-800 text-white">
                        <DialogHeader>
                            <DialogTitle>Novo Projeto</DialogTitle>
                            <DialogDescription>Crie um espaço para organizar suas páginas.</DialogDescription>
                        </DialogHeader>
                        <form action={handleCreate}>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Nome do Projeto</Label>
                                    <Input name="name" placeholder="Ex: Cliente Alpha" className="bg-zinc-900 border-zinc-800" required minLength={3} />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" type="button" onClick={() => setIsOpen(false)}>Cancelar</Button>
                                <Button type="submit" disabled={loading} className="bg-primary text-white">Criar Projeto</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {initialProjects.map(project => (
                    <Card key={project.id} className="bg-zinc-900/50 border-zinc-800 flex flex-col justify-between h-[200px]">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-white">
                                <Folder className="h-5 w-5 text-blue-500" />
                                {project.name}
                            </CardTitle>
                            <CardDescription className="text-zinc-500">
                                {project._count.pages} página(s) conectada(s)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                        </CardContent>
                        <CardFooter className="flex justify-between border-t border-zinc-800/50 pt-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-zinc-400 hover:text-white"
                                onClick={() => handleOpenDashboard(project.id)}
                            >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Abrir Dashboard
                            </Button>
                            <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-red-500 hover:bg-red-500/10" onClick={() => handleDelete(project.id)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    )
}
