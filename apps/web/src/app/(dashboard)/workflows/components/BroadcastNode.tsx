import { memo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { MessageSquare, Users, Link2, ExternalLink, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface InternalButton {
    id: string;
    label: string;
    actionType: string;
    value?: string;
    targetNodeId?: string | null;
}

interface NodeData {
    id: string; // The rule ID
    isRoot: boolean;
    name: string;
    message: string;
    buttons: InternalButton[];
    stats: number;
}

function BroadcastNode({ data, selected, id }: { data: NodeData; selected: boolean; id: string }) {
    const { isRoot, name, message, buttons, stats } = data;
    const { deleteElements } = useReactFlow();

    const onDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        deleteElements({ nodes: [{ id }] });
    };

    return (
        <div className={cn(
            "rounded-2xl border-2 bg-zinc-900 min-w-[320px] max-w-[380px] shadow-2xl transition-all relative overflow-visible",
            isRoot ? "border-emerald-500/50 shadow-emerald-500/10" : "border-zinc-800",
            selected && "ring-4 ring-[#0084FF]/20 border-[#0084FF]"
        )}>
            {/* Input Handle for Child Nodes */}
            {!isRoot && (
                <Handle
                    type="target"
                    position={Position.Left}
                    className="w-4 h-4 bg-zinc-400 border-2 border-zinc-900 !left-[-10px] hover:w-5 hover:h-5 transition-all"
                />
            )}

            {/* Quick Delete Button */}
            {selected && !isRoot && (
                <button
                    onClick={onDelete}
                    className="absolute -top-3 -right-3 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors z-50 border-2 border-zinc-900"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            )}

            {/* Header */}
            <div className={cn(
                "flex items-center justify-between px-5 py-4 rounded-t-2xl border-b border-zinc-800 relative",
                isRoot ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800/30 text-zinc-400"
            )}>
                <div className="flex items-center gap-2.5">
                    <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        isRoot ? "bg-emerald-500/20" : "bg-zinc-800"
                    )}>
                        <MessageSquare className="w-4.5 h-4.5" />
                    </div>
                    <span className="text-[15px] font-bold tracking-tight truncate max-w-[170px]">
                        {name || (isRoot ? 'Mensagem de Boas-vindas' : 'Resposta')}
                    </span>
                </div>
                {/* Stats Badge */}
                <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-full text-xs font-semibold text-white/90" title="Leads">
                    <Users className="w-3.5 h-3.5 text-zinc-400" />
                    {stats || 0}
                </div>
            </div>

            {/* Content Body */}
            <div className="p-5 space-y-4">
                <div className="bg-zinc-800/40 border border-zinc-700/30 rounded-xl px-4 py-3.5 text-[14px] text-zinc-200 whitespace-pre-wrap leading-relaxed min-h-[60px] shadow-inner">
                    {message || <span className="text-zinc-500 italic">Sem mensagem configurada</span>}
                </div>

                {/* Buttons list */}
                {buttons && buttons.length > 0 && (
                    <div className="flex flex-col gap-2.5">
                        {buttons.map((btn, i) => {
                            const isGreen = btn.actionType === 'web_url';
                            return (
                                <div
                                    key={i}
                                    className={cn(
                                        "relative flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl text-[14px] font-bold transition-all border shadow-sm",
                                        isGreen
                                            ? "bg-[#25D366]/5 text-[#25D366] border-[#25D366]/20 hover:bg-[#25D366]/10"
                                            : "bg-[#0084FF]/5 text-[#0084FF] border-[#0084FF]/20 hover:bg-[#0084FF]/10",
                                    )}
                                >
                                    {isGreen ? <ExternalLink className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                                    <span className="truncate">{btn.label}</span>

                                    {/* Output Handle for specific button */}
                                    {btn.actionType === 'flow_jump' && (
                                        <Handle
                                            type="source"
                                            position={Position.Right}
                                            id={btn.id || `btn_${i}`}
                                            className="w-4 h-4 bg-[#0084FF] border-2 border-zinc-900 cursor-crosshair hover:w-5 hover:h-4.5 transition-all !right-[-10px] shadow-lg"
                                        />
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Default Handle if more buttons needed? No, usually 1 per button in manychat. 
                But let's keep one fallback if no buttons exist */}
            {(!buttons || buttons.length === 0) && (
                <Handle
                    type="source"
                    position={Position.Right}
                    id="default"
                    className="w-4 h-4 bg-zinc-600 border-2 border-zinc-900 !right-[-10px] hover:w-5 hover:h-5 transition-all cursor-crosshair shadow-lg"
                />
            )}
        </div>
    );
}

export default memo(BroadcastNode);
