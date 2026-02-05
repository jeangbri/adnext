import { getProjects } from "@/app/actions/projects"
import { ProjectList } from "@/components/projects/project-list"

export default async function ProjectsPage() {
    const projects = await getProjects()

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-white focus:outline-none">Meus Projetos</h2>
                <p className="text-zinc-400">Gerencie seus sites e clientes para organizar suas automações.</p>
            </div>

            <ProjectList initialProjects={projects} />
        </div>
    )
}
