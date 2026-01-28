import { RuleEditor } from "../_components/rule-editor";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

interface EditRulePageProps {
    params: { id: string }
}

export const dynamic = "force-dynamic";

export default async function EditRulePage({ params }: EditRulePageProps) {
    const rule = await prisma.automationRule.findUnique({
        where: { id: params.id },
        include: { actions: { orderBy: { order: 'asc' } } }
    });

    if (!rule) {
        redirect('/workflows');
    }

    return <RuleEditor mode="edit" rule={rule} />
}
