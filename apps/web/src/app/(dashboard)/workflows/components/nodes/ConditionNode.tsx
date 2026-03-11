"use client"

import { memo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { GitBranch, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default memo(function ConditionNode({ data, selected, id }: any) {
    const { deleteElements } = useReactFlow();

    const onDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        deleteElements({ nodes: [{ id }] });
    };

    return (
        <div className={cn(
            "w-[300px] bg-zinc-900 border-2 rounded-2xl shadow-2xl transition-all relative overflow-visible",
            selected ? "border-purple-500 shadow-purple-500/20 ring-4 ring-purple-500/10" : "border-zinc-800"
        )}>
            {/* Input Handle */}
            <Handle
                type="target"
                position={Position.Left}
                className="w-4 h-4 bg-zinc-400 border-2 border-zinc-900 !left-[-10px] hover:w-5 hover:h-5 transition-all"
            />

            {/* Quick Delete Button */}
            {selected && (
                <button
                    onClick={onDelete}
                    className="absolute -top-3 -right-3 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors z-50 border-2 border-zinc-900"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            )}

            <div className="p-4 bg-purple-500/5 rounded-2xl">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                        <GitBranch className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-zinc-100">{data.name || 'Condição'}</h3>
                        <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1 italic">
                            {data.conditionField ? `IF ${data.conditionField} ${data.conditionOperator} "${data.conditionValue}"` : (data.conditionText || 'Defina a regra lógica')}
                        </p>
                    </div>
                </div>

                {/* Condition Branches */}
                <div className="mt-4 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl relative group">
                        <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest">Verdadeiro</span>
                        <Handle
                            type="source"
                            position={Position.Right}
                            id="true"
                            className="w-4 h-4 bg-emerald-500 border-2 border-zinc-900 !right-[-10px] hover:w-5 hover:h-5 transition-all cursor-crosshair shadow-lg"
                        />
                    </div>
                    <div className="flex items-center justify-between bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl relative group">
                        <span className="text-[10px] font-extrabold text-rose-400 uppercase tracking-widest">Falso</span>
                        <Handle
                            type="source"
                            position={Position.Right}
                            id="false"
                            className="w-4 h-4 bg-rose-500 border-2 border-zinc-900 !right-[-10px] hover:w-5 hover:h-5 transition-all cursor-crosshair shadow-lg"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
});
