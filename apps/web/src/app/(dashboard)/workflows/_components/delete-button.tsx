"use client"

import { Button } from "@/components/ui/button"
import { Trash2, Loader2 } from "lucide-react"
import { useState } from "react"
import { deleteRuleAction } from "../actions"
import { toast } from "sonner"

export function DeleteRuleButton({ ruleId }: { ruleId: string }) {
    const [loading, setLoading] = useState(false)

    const handleDelete = async () => {
        if (!confirm("Tem certeza que deseja excluir esta regra? Esta ação não pode ser desfeita.")) return

        try {
            setLoading(true)
            await deleteRuleAction(ruleId)
            toast.success("Regra excluída com sucesso")
        } catch (error) {
            toast.error("Erro ao excluir regra")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-zinc-400 hover:text-red-500 hover:bg-red-500/10"
            onClick={handleDelete}
            disabled={loading}
        >
            {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
                <Trash2 className="w-4 h-4" />
            )}
        </Button>
    )
}
