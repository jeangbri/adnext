import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

export interface UserScope {
    userId: string
    projectId: string | null
    pageId: string | 'ALL' | null
    pageIds: string[]
}

export async function getScopedContext(): Promise<UserScope | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const cookieStore = cookies()
    const projectId = cookieStore.get("adnext_project")?.value
    const pageId = cookieStore.get("adnext_page")?.value

    if (!projectId) {
        // Fallback: Could return default project logic here
        return { userId: user.id, projectId: null, pageId: null, pageIds: [] }
    }

    try {
        // Validate Project
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { pages: { select: { pageId: true } } }
        })

        if (!project || project.userId !== user.id) {
            return { userId: user.id, projectId: null, pageId: null, pageIds: [] }
        }

        const availablePageIds = project.pages.map(p => p.pageId)

        // Validate Page
        let selectedPageId = pageId
        if (pageId && pageId !== 'ALL') {
            if (!availablePageIds.includes(pageId)) {
                selectedPageId = 'ALL' // Fallback to ALL if page not in project
            }
        }

        return {
            userId: user.id,
            projectId,
            pageId: selectedPageId || 'ALL',
            pageIds: (selectedPageId === 'ALL' || !selectedPageId) ? availablePageIds : [selectedPageId]
        }
    } catch (e) {
        console.error("Scope Error", e)
        return { userId: user.id, projectId: null, pageId: null, pageIds: [] }
    }
}
