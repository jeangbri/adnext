"use client"

import { useState, useEffect } from 'react';
import { X, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Node } from '@xyflow/react';

interface PropertiesPanelProps {
    selectedNode: Node | null;
    onUpdateNode: (nodeId: string, data: any) => void;
    onDeleteNode: (nodeId: string) => void;
    onClose: () => void;
}

export default function PropertiesPanel({ selectedNode, onUpdateNode, onDeleteNode, onClose }: PropertiesPanelProps) {
    const [data, setData] = useState<any>({});

    useEffect(() => {
        if (selectedNode) {
            setData(selectedNode.data);
        }
    }, [selectedNode]);

    if (!selectedNode) return null;

    const handleChange = (key: string, value: any) => {
        const newData = { ...data, [key]: value };
        setData(newData);
        onUpdateNode(selectedNode.id, newData);
    };

    const handleButtonChange = (index: number, key: string, value: any) => {
        const newButtons = [...(data.buttons || [])];
        newButtons[index] = { ...newButtons[index], [key]: value };
        handleChange('buttons', newButtons);
    };

    const handleAddButton = () => {
        const newButtons = [...(data.buttons || []), {
            id: `btn_${Date.now()}`,
            label: 'Novo Botão',
            actionType: 'flow_jump',
            targetNodeId: null
        }];
        handleChange('buttons', newButtons);
    };

    const handleRemoveButton = (index: number) => {
        const newButtons = [...(data.buttons || [])];
        newButtons.splice(index, 1);
        handleChange('buttons', newButtons);
    };

    return (
        <div className="w-80 bg-zinc-950 border-l border-zinc-800 flex flex-col h-full z-10">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-200">Editar Bloco</h3>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-zinc-400 hover:text-white">
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">

                {/* Common Name */}
                <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400">Nome do Bloco</label>
                    <input
                        type="text"
                        value={data.name || ''}
                        onChange={(e) => handleChange('name', e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[#0084FF] transition-colors"
                    />
                </div>

                {/* Message Node Specifics */}
                {(selectedNode.type === 'broadcastNode' || selectedNode.type === 'messageNode') && (
                    <>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-zinc-400">Mensagem de Texto</label>
                            <textarea
                                value={data.message || ''}
                                onChange={(e) => handleChange('message', e.target.value)}
                                rows={4}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[#0084FF] transition-colors resize-none"
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-zinc-400">Botões ({data.buttons?.length || 0}/3)</label>
                                {(data.buttons?.length || 0) < 3 && (
                                    <Button variant="ghost" size="sm" onClick={handleAddButton} className="h-6 text-[#0084FF] hover:bg-[#0084FF]/10 hover:text-[#0084FF] px-2 text-xs">
                                        <Plus className="w-3 h-3 mr-1" /> Adicionar
                                    </Button>
                                )}
                            </div>

                            <div className="flex flex-col gap-3">
                                {data.buttons?.map((btn: any, idx: number) => (
                                    <div key={btn.id} className="p-3 bg-zinc-900 border border-zinc-800 rounded-md space-y-3 relative group">
                                        <button
                                            onClick={() => handleRemoveButton(idx)}
                                            className="absolute -top-2 -right-2 bg-red-500/10 text-red-500 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                        <div>
                                            <input
                                                type="text"
                                                value={btn.label}
                                                onChange={(e) => handleButtonChange(idx, 'label', e.target.value)}
                                                placeholder="Título do Botão"
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-[#0084FF]"
                                            />
                                        </div>
                                        <div>
                                            <select
                                                value={btn.actionType}
                                                onChange={(e) => handleButtonChange(idx, 'actionType', e.target.value)}
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-[#0084FF]"
                                            >
                                                <option value="flow_jump">Continuar Fluxo</option>
                                                <option value="web_url">Abrir Site</option>
                                            </select>
                                        </div>
                                        {btn.actionType === 'web_url' && (
                                            <div>
                                                <input
                                                    type="url"
                                                    value={btn.url || ''}
                                                    onChange={(e) => handleButtonChange(idx, 'url', e.target.value)}
                                                    placeholder="https://..."
                                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-[#0084FF]"
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {/* Delay Node Specifics */}
                {selectedNode.type === 'delayNode' && (
                    <div className="flex gap-2">
                        <div className="flex-1 space-y-2">
                            <label className="text-xs font-medium text-zinc-400">Tempo</label>
                            <input
                                type="number"
                                value={data.delayAmount || 1}
                                onChange={(e) => handleChange('delayAmount', parseInt(e.target.value))}
                                min="1"
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500"
                            />
                        </div>
                        <div className="flex-1 space-y-2">
                            <label className="text-xs font-medium text-zinc-400">Unidade</label>
                            <select
                                value={data.delayUnit || 'Minutos'}
                                onChange={(e) => handleChange('delayUnit', e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500"
                            >
                                <option value="Segundos">Segundos</option>
                                <option value="Minutos">Minutos</option>
                                <option value="Horas">Horas</option>
                                <option value="Dias">Dias</option>
                            </select>
                        </div>
                    </div>
                )}

                {/* Condition Node Specifics */}
                {selectedNode.type === 'conditionNode' && (
                    <div className="space-y-4">
                        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Regra de Condição</label>

                        <div className="space-y-3">
                            <div className="space-y-1">
                                <span className="text-[10px] text-zinc-500 font-medium">SE O CAMPO</span>
                                <select
                                    value={data.conditionField || 'tags'}
                                    onChange={(e) => handleChange('conditionField', e.target.value)}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-purple-500"
                                >
                                    <option value="tags">Tags do Lead</option>
                                    <option value="name">Nome do Lead</option>
                                    <option value="created_at">Data de Criação</option>
                                    <option value="last_interaction">Última Interação</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <span className="text-[10px] text-zinc-500 font-medium">FOR</span>
                                <select
                                    value={data.conditionOperator || 'contains'}
                                    onChange={(e) => handleChange('conditionOperator', e.target.value)}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-purple-500"
                                >
                                    <option value="contains">Contém</option>
                                    <option value="not_contains">Não Contém</option>
                                    <option value="equals">Igual a</option>
                                    <option value="not_equals">Diferente de</option>
                                    <option value="exists">Existe / Preenchido</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <span className="text-[10px] text-zinc-500 font-medium">O VALOR</span>
                                <input
                                    type="text"
                                    value={data.conditionValue || ''}
                                    onChange={(e) => handleChange('conditionValue', e.target.value)}
                                    placeholder="Ex: VIP, Comprador..."
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-purple-500"
                                />
                            </div>
                        </div>

                        <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                            <p className="text-[10px] text-purple-300 font-medium italic">
                                Preview: SE {data.conditionField || 'Tag'} {data.conditionOperator || 'contém'} "{data.conditionValue || '...'}"
                            </p>
                        </div>
                    </div>
                )}


                {/* Start Node Specifics */}
                {selectedNode.type === 'startNode' && (
                    <div className="space-y-4">
                        <label className="text-xs font-medium text-emerald-500 uppercase tracking-wider">Configuração do Gatilho</label>

                        <div className="space-y-3">
                            <div className="space-y-1">
                                <span className="text-[10px] text-zinc-500 font-medium">TIPO DE ENTRADA</span>
                                <select
                                    value={data.triggerType || 'MESSAGE_ANY'}
                                    onChange={(e) => handleChange('triggerType', e.target.value)}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                                >
                                    <option value="MESSAGE_ANY">Qualquer Mensagem</option>
                                    <option value="MESSAGE_KEYWORD">Palavra-Chave</option>
                                    <option value="POSTBACK">Clique em Botão (Postback)</option>
                                    <option value="MESSAGE_OUTSIDE_24H">Inatividade (Broadcast 24h+)</option>
                                    <option value="REF_PARAM">Link / Ref Param (m.me)</option>
                                    <option value="COMMENT_ON_POST">Comentário em Post</option>
                                </select>
                            </div>

                            {data.triggerType === 'MESSAGE_KEYWORD' && (
                                <>
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-zinc-500 font-medium">PALAVRAS-CHAVE (Separe por vírgula)</span>
                                        <input
                                            type="text"
                                            value={data.keywords?.join(', ') || ''}
                                            onChange={(e) => {
                                                const words = e.target.value.split(',').map((w: string) => w.trim()).filter((w: string) => w.length > 0);
                                                handleChange('keywords', words);
                                            }}
                                            placeholder="Ex: promocao, cupom, ajuda"
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-zinc-500 font-medium">REGRA DE CORRESPONDÊNCIA</span>
                                        <select
                                            value={data.matchType || 'CONTAINS'}
                                            onChange={(e) => handleChange('matchType', e.target.value)}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                                        >
                                            <option value="CONTAINS">Mensagem Contém</option>
                                            <option value="EXACT">Mensagem Exata</option>
                                            <option value="STARTS_WITH">Começa Com</option>
                                        </select>
                                    </div>
                                </>
                            )}

                            {(data.triggerType === 'POSTBACK' || data.triggerType === 'REF_PARAM') && (
                                <div className="space-y-1">
                                    <span className="text-[10px] text-zinc-500 font-medium">
                                        {data.triggerType === 'POSTBACK' ? 'PAYLOAD DO BOTÃO (Ex: MENUPRINCIPAL)' : 'PARÂMETRO REF (Ex: campanha_natal)'}
                                    </span>
                                    <input
                                        type="text"
                                        value={data.triggerPayload || ''}
                                        onChange={(e) => handleChange('triggerPayload', e.target.value)}
                                        placeholder={data.triggerType === 'POSTBACK' ? 'Payload Exato' : 'Ref Exato'}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {!data.isRoot && (
                <div className="p-4 border-t border-zinc-800">
                    <Button
                        variant="destructive"
                        className="w-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20"
                        onClick={() => {
                            if (selectedNode) {
                                onDeleteNode(selectedNode.id);
                            }
                        }}
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir Bloco
                    </Button>
                </div>
            )}
        </div>
    );
}
