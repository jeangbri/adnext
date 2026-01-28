import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getPrimaryWorkspace } from "@/lib/workspace";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { WorkflowCard } from "@/components/workflow-card";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return <div>Não autorizado</div>;

    const workspace = await getPrimaryWorkspace(user.id, user.email || '');

    const workflows = await prisma.workflow.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { updatedAt: 'desc' }
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Minhas Automações</h2>
                    <p className="text-muted-foreground">Gerencie seus fluxos de resposta automática</p>
                </div>
                <Link href="/workflows/create">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Criar automação
                    </Button>
                </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {workflows.length === 0 && (
                    <div className="col-span-full text-center py-10 text-muted-foreground">
                        Você ainda não tem automações. Crie a primeira!
                    </div>
                )}
                {workflows.map((wf) => (
                    <WorkflowCard
                        key={wf.id}
                        workflow={{
                            ...wf,
                            updatedAt: wf.updatedAt.toISOString(),
                            createdAt: wf.createdAt.toISOString(),
                            publishedAt: wf.publishedAt ? wf.publishedAt.toISOString() : null
                        }}
                    />
                ))}
            </div>
        </div>
    )
}
