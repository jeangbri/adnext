import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

export interface UserScope {
    userId: string
    projectId: string | null
    pageId: string | 'ALL' | null
    pageIds: string[]
}

/**
 * Get scoped context with optional pre-fetched userId to avoid duplicate getUser() calls.
 * Pages that already have the user can pass it in to skip the auth check.
 */
export async function getScopedContext(preloadedUserId?: string): Promise<UserScope | null> {
    let userId = preloadedUserId

    if (!userId) {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return null
        userId = user.id
    }

    const cookieStore = cookies()
    const projectId = cookieStore.get("adnext_project")?.value
    const pageId = cookieStore.get("adnext_page")?.value

    if (!projectId) {
        return { userId, projectId: null, pageId: null, pageIds: [] }
    }

    try {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: {
                id: true,
                userId: true,
                pages: { select: { pageId: true } }
            }
        })

        if (!project || project.userId !== userId) {
            return { userId, projectId: null, pageId: null, pageIds: [] }
        }

        const availablePageIds = project.pages.map(p => p.pageId)

        let selectedPageId = pageId
        if (pageId && pageId !== 'ALL') {
            if (!availablePageIds.includes(pageId)) {
                selectedPageId = 'ALL'
            }
        }

        return {
            userId,
            projectId,
            pageId: selectedPageId || 'ALL',
            pageIds: (selectedPageId === 'ALL' || !selectedPageId) ? availablePageIds : [selectedPageId]
        }
    } catch (e) {
        console.error("Scope Error", e)
        return { userId, projectId: null, pageId: null, pageIds: [] }
    }
}
