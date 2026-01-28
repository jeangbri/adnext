"use client"

import React from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2 } from "lucide-react";
import { useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface WorkflowCardProps {
    workflow: any;
}

export function WorkflowCard({ workflow }: WorkflowCardProps) {
    const router = useRouter();
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        setDeleting(true);
        try {
            const res = await fetch(`/api/workflows/${workflow.id}`, {
                method: 'DELETE'
            });

            if (!res.ok) throw new Error("Falha ao excluir");

            toast.success("Automação excluída");
            router.refresh();
        } catch (error) {
            toast.error("Erro ao excluir automação");
        } finally {
            setDeleting(false);
        }
    }

    const updatedAt = new Date(workflow.updatedAt);

    return (
        <Card className="hover:shadow-md transition-shadow cursor-pointer relative group overflow-hidden">
            <Link href={`/workflows/${workflow.id}/editor`} className="block h-full">
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-lg truncate pr-8">{workflow.title}</CardTitle>
                        <div className={`w-3 h-3 min-w-[12px] rounded-full ${workflow.isActive ? 'bg-green-500' : 'bg-gray-300'}`} title={workflow.isActive ? "Ativo" : "Inativo"} />
                    </div>
                    <CardDescription className="line-clamp-2 min-h-[40px]">{workflow.description || "Sem descrição"}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-xs text-muted-foreground space-y-1">
                        <p>Canais: {Array.isArray(workflow.channels) ? workflow.channels.join(', ') : JSON.parse(JSON.stringify(workflow.channels)).join(', ')}</p>
                        <p>Execuções: {workflow.runCount}</p>
                        <p>Atualizado em: {format(updatedAt, "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}</p>
                    </div>
                </CardContent>
            </Link>

            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta ação não pode ser desfeita. A automação &quot;{workflow.title}&quot; será excluída permanentemente.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={(e: React.MouseEvent) => e.stopPropagation()}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDelete}
                                className="bg-destructive hover:bg-destructive/90 text-white"
                                disabled={deleting}
                            >
                                {deleting ? "Excluindo..." : "Excluir"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </Card>
    )
}
