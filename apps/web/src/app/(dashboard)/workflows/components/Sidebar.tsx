import React from 'react';
import { MessageSquare, Clock, GitBranch, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const NODE_TYPES = [
    {
        type: 'startNode',
        label: 'Gatilho / Gatilho',
        description: 'Inicia a automação',
        icon: Zap,
        color: 'text-emerald-500',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20'
    },
    {
        type: 'broadcastNode',
        label: 'Mensagem',
        description: 'Enviar texto e botões',
        icon: MessageSquare,
        color: 'text-[#0084FF]',
        bg: 'bg-[#0084FF]/10',
        border: 'border-[#0084FF]/20'
    },
    {
        type: 'delayNode',
        label: 'Timer / Atraso',
        description: 'Aguardar um tempo',
        icon: Clock,
        color: 'text-amber-500',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20'
    },
    {
        type: 'conditionNode',
        label: 'Condição / IF',
        description: 'Regra lógica Sim/Não',
        icon: GitBranch,
        color: 'text-purple-500',
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/20'
    },
];

export default function Sidebar() {
    const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.setData('application/reactflow-label', label);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <aside className="p-6 h-full flex flex-col gap-6 select-none overflow-y-auto custom-scrollbar">
            <div>
                <h3 className="text-[11px] font-extrabold text-zinc-500 uppercase tracking-widest mb-4">
                    Painel de Blocos
                </h3>
                <p className="text-[12px] text-zinc-400 leading-relaxed mb-6">
                    Arraste os blocos para o canvas para montar seu fluxo.
                </p>
            </div>

            <div className="flex flex-col gap-3">
                {NODE_TYPES.map((node) => (
                    <div
                        key={node.type}
                        draggable
                        onDragStart={(e) => onDragStart(e, node.type, node.label)}
                        className={cn(
                            "group flex items-center gap-4 p-4 rounded-2xl border bg-zinc-900/50 transition-all cursor-grab active:cursor-grabbing hover:border-zinc-500 hover:shadow-xl hover:bg-zinc-800",
                            node.border
                        )}
                    >
                        <div className={cn(
                            "w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
                            node.bg,
                            node.color
                        )}>
                            <node.icon className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[13px] font-bold text-zinc-100">{node.label}</span>
                            <span className="text-[11px] text-zinc-500">{node.description}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-auto pt-6 border-t border-zinc-900/50">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-zinc-900 to-black border border-zinc-800/50">
                    <p className="text-[10px] text-zinc-500 leading-relaxed italic">
                        Dica: Use as curvas para conectar saídas (lados direitos) a entradas (lados esquerdos).
                    </p>
                </div>
            </div>
        </aside>
    );
}
