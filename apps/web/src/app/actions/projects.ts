"use server"

import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getProjects() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    return await prisma.project.findMany({
        where: { userId: user.id },
        include: {
            pages: {
                select: { pageId: true, pageName: true, isActive: true }
            },
            _count: {
                select: { pages: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    })
}

export async function createProject(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const name = formData.get("name") as string
    if (!name || name.length < 3) throw new Error("Nome inválido (min 3 chars)")

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 10000)

    try {
        await prisma.project.create({
            data: {
                userId: user.id,
                name,
                slug
            }
        })
        revalidatePath('/projects')
        return { success: true }
    } catch (e) {
        console.error(e)
        return { error: "Erro ao criar projeto" }
    }
}

export async function updatePageProject(pageId: string, projectId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Verify project belongs to user
    const project = await prisma.project.findUnique({
        where: { id: projectId }
    })

    if (!project || project.userId !== user.id) {
        throw new Error("Projeto inválido ou sem permissão")
    }

    await prisma.messengerPage.update({
        where: { pageId },
        data: {
            projectId,
            userId: user.id // Ensure ownership is claimed
        }
    })

    revalidatePath('/settings/integracoes')
    return { success: true }
}

export async function deleteProject(projectId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { _count: { select: { pages: true } } }
    })

    if (!project || project.userId !== user.id) throw new Error("Projeto não encontrado")

    if (project._count.pages > 0) {
        throw new Error("Não é possível deletar projeto com páginas associadas.")
    }

    await prisma.project.delete({
        where: { id: projectId }
    })
    revalidatePath('/projects')
}
