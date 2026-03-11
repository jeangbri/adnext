"use client"

import { memo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Clock, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default memo(function DelayNode({ data, selected, id }: any) {
    const { deleteElements } = useReactFlow();

    const onDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        deleteElements({ nodes: [{ id }] });
    };

    return (
        <div className={cn(
            "w-[280px] bg-zinc-900 border-2 rounded-2xl shadow-2xl transition-all relative overflow-visible",
            selected ? "border-amber-500 shadow-amber-500/20 ring-4 ring-amber-500/10" : "border-zinc-800"
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

            <div className="p-4 flex items-center gap-3 bg-amber-500/5 rounded-2xl">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-zinc-100">{data.name || 'Atraso / Timer'}</h3>
                    <p className="text-xs text-zinc-400 mt-1">
                        Esperar por <span className="font-semibold text-amber-400">{data.delayAmount || 1} {data.delayUnit || 'Minutos'}</span>
                    </p>
                </div>
            </div>

            {/* Output Handle */}
            <Handle
                type="source"
                position={Position.Right}
                className="w-4 h-4 bg-amber-500 border-2 border-zinc-900 hover:w-5 hover:h-5 transition-all cursor-crosshair !right-[-10px] shadow-lg"
            />
        </div>
    );
});
