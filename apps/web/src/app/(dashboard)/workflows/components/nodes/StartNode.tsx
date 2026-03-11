import { memo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Zap, Trash2, KeyRound, Link as LinkIcon, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export default memo(function StartNode({ data, selected, id }: any) {
    const { deleteElements } = useReactFlow();

    const onDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        deleteElements({ nodes: [{ id }] });
    };

    const getTriggerInfo = () => {
        switch (data.triggerType) {
            case 'MESSAGE_KEYWORD':
                return {
                    label: 'Palavra-Chave',
                    desc: data.keywords?.join(', ') || 'Nenhuma palavra configurada',
                    icon: <KeyRound className="w-5 h-5 text-white" />
                };
            case 'POSTBACK':
                return {
                    label: 'Clique em Botão (Postback)',
                    desc: data.triggerPayload || 'Nenhum payload',
                    icon: <Zap className="w-5 h-5 text-white" />
                };
            case 'REF_PARAM':
                return {
                    label: 'Link M.me (Ref)',
                    desc: data.triggerPayload || 'Nenhum ref',
                    icon: <LinkIcon className="w-5 h-5 text-white" />
                };
            case 'MESSAGE_OUTSIDE_24H':
                return {
                    label: 'Inatividade (Broadcast 24h+)',
                    desc: 'Requer opt-in ou permissão especial',
                    icon: <MessageSquare className="w-5 h-5 text-white" />
                };
            case 'COMMENT_ON_POST':
                return {
                    label: 'Comentário em Post',
                    desc: 'Qualquer post ou post específico',
                    icon: <MessageSquare className="w-5 h-5 text-white" />
                };
            default:
                return {
                    label: 'Qualquer Mensagem',
                    desc: 'Dispara para qualquer texto',
                    icon: <MessageSquare className="w-5 h-5 text-white" />
                };
        }
    };

    const info = getTriggerInfo();

    return (
        <div className={cn(
            "w-[280px] bg-emerald-500 border-2 rounded-2xl shadow-2xl transition-all relative overflow-visible",
            selected ? "border-white shadow-emerald-500/40 ring-4 ring-emerald-500/20" : "border-emerald-600"
        )}>
            <div className="p-4 flex items-center gap-3 bg-emerald-950/20 text-white rounded-2xl">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
                    {info.icon}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">{data.name || 'Gatilho / Trigger'}</h3>
                    <div className="text-[11px] text-emerald-100 mt-1 opacity-90 truncate">
                        <Badge variant="secondary" className="bg-emerald-400/20 hover:bg-emerald-400/30 text-white border-0 px-1.5 py-0.5 rounded mr-1">
                            {info.label}
                        </Badge>
                    </div>
                </div>
            </div>

            <div className="px-4 pb-3 pt-1 bg-emerald-950/20 rounded-b-2xl border-t border-emerald-500/30">
                <p className="text-[11px] text-emerald-100 italic truncate font-medium">
                    {info.desc}
                </p>
            </div>

            {/* Source Handle */}
            <Handle
                type="source"
                position={Position.Right}
                className="w-4 h-4 bg-emerald-300 border-2 border-emerald-700 hover:w-5 hover:h-5 transition-all !right-[-10px] shadow-lg"
            />
        </div>
    );
});
