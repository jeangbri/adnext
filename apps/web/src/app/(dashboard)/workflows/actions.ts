'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function deleteRuleAction(ruleId: string) {
    if (!ruleId) return

    try {
        await prisma.automationRule.delete({
            where: { id: ruleId }
        })
        revalidatePath('/workflows')
    } catch (error) {
        console.error("Error deleting rule:", error)
        throw error
    }
}
