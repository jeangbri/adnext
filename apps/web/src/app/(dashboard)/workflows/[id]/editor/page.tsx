"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from 'sonner'
import { Save, Play, ArrowLeft, Trash2, Plus, Info, Braces, X } from 'lucide-react'
import Link from 'next/link'
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    Node,
    ReactFlowProvider,
    BackgroundVariant,
    useReactFlow
} from '@xyflow/react';

import { InstagramNode, StartNode, TriggerNode, DelayNode, TagNode, ConditionNode, AINode, WebhookNode } from "@/components/flow/custom-nodes";
import { Sidebar } from "@/components/flow/sidebar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command"

// Node Types Registry
const nodeTypes = {
    instagram: InstagramNode,
    start: StartNode,
    trigger: TriggerNode,
    trigger_comment: TriggerNode,
    trigger_mention: TriggerNode,
    delay: DelayNode,
    tag: TagNode,
    condition: ConditionNode,
    ai_response: AINode,
    webhook: WebhookNode
};

export default function EditorPage() {
    return (
        <ReactFlowProvider>
            <FlowEditor />
        </ReactFlowProvider>
    )
}

function FlowEditor() {
    const { id } = useParams();
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const { screenToFlowPosition } = useReactFlow();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [workflow, setWorkflow] = useState<any>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);

    // React Flow State
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    useEffect(() => {
        fetchWorkflow();
    }, [id]);

    const fetchWorkflow = async () => {
        const res = await fetch(`/api/workflows/${id}`);
        if (res.ok) {
            const data = await res.json();
            setWorkflow(data.workflow);

            if (data.workflow.flowDefinition) {
                // Load from Graph Definition (New Way)
                const flow = data.workflow.flowDefinition;
                setNodes(flow.nodes || []);
                setEdges(flow.edges || []);
            } else {
                // Fallback: Construct from Triggers/Actions (Old Way - Migration)
                const initialNodes: Node[] = [];
                const initialEdges: Edge[] = [];
                let xPos = 100;
                const yPos = 200;

                // 1. Start Node
                initialNodes.push({ id: 'start', type: 'start', position: { x: xPos, y: yPos }, data: { label: 'Início' } });
                xPos += 400;

                // 2. Actions
                if (data.actions && data.actions.length > 0) {
                    data.actions.forEach((action: any, index: number) => {
                        initialNodes.push({
                            id: `action-${action.id}`,
                            type: 'instagram',
                            position: { x: xPos, y: yPos },
                            data: {
                                title: 'Mensagem',
                                subtitle: 'Resposta automática',
                                type: 'reply',
                                content: {
                                    message: action.configJson.replyMessage,
                                    cta: action.configJson.cta,
                                    buttons: action.configJson.buttons || [],
                                    imageUrl: action.configJson.imageUrl
                                },
                                originalActionId: action.id
                            }
                        });
                        const prevNodeId = index === 0 ? 'start' : `action-${data.actions[index - 1].id}`;
                        initialEdges.push({
                            id: `e-${prevNodeId}-action-${action.id}`,
                            source: prevNodeId,
                            target: `action-${action.id}`,
                            animated: true,
                            style: { stroke: '#94a3b8' }
                        });
                        xPos += 450;
                    });
                }
                setNodes(initialNodes);
                setEdges(initialEdges);
            }
        }
        setLoading(false);
    }

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#94a3b8', strokeWidth: 1.5 } }, eds)),
        [setEdges],
    );

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');
            if (typeof type === 'undefined' || !type) {
                return;
            }

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const newNode: Node = {
                id: `${type}-${Date.now()}`,
                type,
                position,
                data: { label: `${type} node` },
            };

            // Set default data
            if (type === 'instagram') {
                newNode.data = { title: 'Mensagem', subtitle: 'Enviar mensagem', type: 'reply', content: { message: '', buttons: [] } }
            } else if (type === 'delay') {
                newNode.data = { time: '1 minuto(s)' }
            } else if (type === 'tag') {
                newNode.data = { tags: ['NOVAS_TAGS'] }
            } else if (type === 'trigger') {
                newNode.data = { type: 'DM_RECEIVED', config: { keyword: '', matchType: 'exact' } }
            } else if (type === 'trigger_comment') {
                newNode.data = { type: 'FEED_COMMENT', config: { keyword: '', matchType: 'contains' } }
            } else if (type === 'trigger_mention') {
                newNode.data = { type: 'trigger_mention', config: { keyword: '', matchType: 'contains' } }
            } else if (type === 'ai_response') {
                newNode.data = { prompt: 'Você é um assistente prestativo. Responda a dúvida do cliente baseada no contexto...', model: 'gpt-4o-mini' }
            } else if (type === 'condition') {
                newNode.data = { condition: { field: 'tag', operator: 'has_tag', value: '' } }
            } else if (type === 'webhook') {
                newNode.data = { url: '', method: 'POST', headers: {} }
            }

            setNodes((nds) => nds.concat(newNode));
        },
        [screenToFlowPosition, setNodes],
    );

    const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        setSelectedNode(node);
        setIsSidebarOpen(true);
    }, []);

    const onPaneClick = useCallback(() => {
        setIsSidebarOpen(false);
        setSelectedNode(null);
    }, []);

    const updateNodeData = (nodeId: string, newData: any) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    const updatedNode = { ...node, data: { ...node.data, ...newData } };
                    if (selectedNode?.id === nodeId) setSelectedNode(updatedNode);
                    return updatedNode;
                }
                return node;
            })
        );
    };

    const deleteNode = useCallback(() => {
        if (selectedNode) {
            setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
            setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
            setSelectedNode(null);
            setIsSidebarOpen(false);
        }
    }, [selectedNode, setNodes, setEdges]);

    const handleSave = async (publish = false) => {
        setSaving(true);
        try {
            // Save the entire Graph
            const flowDefinition = { nodes, edges };

            const res = await fetch(`/api/workflows/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workflow: {
                        status: publish ? 'PUBLISHED' : workflow.status,
                        isActive: publish ? true : workflow.isActive,
                        flowDefinition
                    }
                })
            });

            if (!res.ok) throw new Error("Erro ao salvar");

            toast.success(publish ? "Automação Publicada!" : "Salvo com sucesso!");
            if (publish) {
                setWorkflow({ ...workflow, status: 'PUBLISHED', flowDefinition });
            }
        } catch (e) {
            console.error(e);
            toast.error("Erro ao salvar");
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div className="flex items-center justify-center h-screen text-muted-foreground">Carregando editor...</div>

    return (
        <div className="h-[calc(100vh-theme(spacing.16))] flex flex-col bg-slate-50">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-3 border-b bg-white shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <Link href="/workflows">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-5 h-5 text-slate-500" />
                        </Button>
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold text-slate-800">{workflow?.title}</h2>
                            <Badge variant={workflow?.status === 'PUBLISHED' ? 'success' : 'secondary'} className="text-xs">
                                {workflow?.status === 'PUBLISHED' ? 'Publicado' : 'Rascunho'}
                            </Badge>
                        </div>
                        <p className="text-xs text-slate-500">{workflow?.description || 'Fluxo de automação'}</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => handleSave(false)} disabled={saving} className="border-slate-200">
                        <Save className="w-4 h-4 mr-2" /> Salvar
                    </Button>
                    <Button onClick={() => handleSave(true)} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Play className="w-4 h-4 mr-2" /> {workflow?.status === 'PUBLISHED' ? 'Atualizar' : 'Publicar'}
                    </Button>
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 flex overflow-hidden">
                <Sidebar />
                <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={onNodeClick}
                        onPaneClick={onPaneClick}
                        onDragOver={onDragOver}
                        onDrop={onDrop}
                        nodeTypes={nodeTypes}
                        fitView
                        className="bg-slate-50"
                    >
                        <Background color="#e2e8f0" gap={20} size={1} variant={BackgroundVariant.Dots} />
                        <Controls className="bg-white border-slate-200 shadow-sm text-slate-600" />
                        <MiniMap className="border border-slate-200 shadow-sm rounded-lg overflow-hidden" />
                    </ReactFlow>
                </div>
            </div>

            {/* Properties Sidebar (Right) */}
            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
                <SheetContent className="w-[400px] sm:w-[450px] overflow-y-auto">
                    <SheetHeader className="mb-6">
                        <div className="flex items-center justify-between">
                            <SheetTitle>
                                {selectedNode?.type === 'instagram' ? 'Editar Mensagem' :
                                    selectedNode?.type?.startsWith('trigger') ? 'Configurar Gatilho' :
                                        selectedNode?.type === 'ai_response' ? 'Configurar Inteligência Artificial' :
                                            selectedNode?.type === 'webhook' ? 'Configurar Webhook/API' :
                                                selectedNode?.type === 'delay' ? 'Editar Aguardar' :
                                                    selectedNode?.type === 'tag' ? 'Editar Tags' :
                                                        selectedNode?.type === 'condition' ? 'Editar Condição' : 'Propriedades'}
                            </SheetTitle>
                            <Button variant="ghost" size="icon" onClick={deleteNode} className="text-red-500 hover:bg-red-50 hover:text-red-600">
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                        <SheetDescription>
                            Configure os detalhes deste bloco.
                        </SheetDescription>
                    </SheetHeader>

                    {selectedNode && (
                        <div className="space-y-6">
                            {/* AI RESPONSE CONFIG */}
                            {selectedNode.type === 'ai_response' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Instrução da IA (Prompt)</label>
                                        <Textarea
                                            placeholder="Ex: Você é um vendedor da loja Creatye..."
                                            className="min-h-[150px] bg-slate-50"
                                            value={(selectedNode.data as any).prompt || ''}
                                            onChange={(e) => updateNodeData(selectedNode.id, { prompt: e.target.value })}
                                        />
                                        <p className="text-[10px] text-slate-400">
                                            A IA usará o histórico da conversa para gerar uma resposta baseada nesta instrução.
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Modelo</label>
                                        <select
                                            className="w-full p-2 bg-slate-50 border rounded-md text-sm"
                                            value={(selectedNode.data as any).model || 'gpt-4o-mini'}
                                            onChange={(e) => updateNodeData(selectedNode.id, { model: e.target.value })}
                                        >
                                            <option value="gpt-4o-mini">GPT-4o Mini (Rápido/Barato)</option>
                                            <option value="gpt-4o">GPT-4o (Poderoso)</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* WEBHOOK CONFIG */}
                            {selectedNode.type === 'webhook' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">URL do Endpoint</label>
                                        <Input
                                            placeholder="https://sua-api.com/webhooks"
                                            value={(selectedNode.data as any).url || ''}
                                            onChange={(e) => updateNodeData(selectedNode.id, { url: e.target.value })}
                                            className="bg-slate-50"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Método</label>
                                        <Tabs
                                            defaultValue={(selectedNode.data as any).method || 'POST'}
                                            onValueChange={(val) => updateNodeData(selectedNode.id, { method: val })}
                                        >
                                            <TabsList className="grid w-full grid-cols-2 bg-slate-100">
                                                <TabsTrigger value="POST">POST</TabsTrigger>
                                                <TabsTrigger value="GET">GET</TabsTrigger>
                                            </TabsList>
                                        </Tabs>
                                    </div>
                                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                                        <p className="text-[10px] text-amber-700 leading-relaxed">
                                            <strong>Nota:</strong> Enviaremos o ID do usuário e o conteúdo da última interação no corpo da requisição (JSON).
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* INSTAGRAM (MESSAGE) CONFIG */}
                            {(selectedNode.type === 'instagram' || selectedNode.type?.startsWith('trigger')) && selectedNode.type !== 'ai_response' && selectedNode.type !== 'webhook' && (
                                <>
                                    {/* Exibir o config de gatilho apenas se for tipo trigger */}
                                    {selectedNode.type.startsWith('trigger') && (
                                        <div className="space-y-4 mb-6 pb-6 border-b border-dashed">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-slate-700">Configuração de Gatilho</label>
                                                <div className="space-y-2">
                                                    <label className="text-xs text-slate-500">Palavra-Chave</label>
                                                    <Input
                                                        placeholder="Ex: QUERO"
                                                        value={(selectedNode.data as any).config?.keyword || ''}
                                                        onChange={(e) => updateNodeData(selectedNode.id, {
                                                            config: { ...(selectedNode.data as any).config, keyword: e.target.value }
                                                        })}
                                                        className="bg-slate-50 font-mono uppercase"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {selectedNode.type === 'instagram' && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-sm font-medium text-slate-700">Mensagem</label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                                                            <Braces className="w-3 h-3" /> Variáveis
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[200px] p-0" align="end">
                                                        <Command>
                                                            <CommandInput placeholder="Buscar variável..." />
                                                            <CommandList>
                                                                <CommandEmpty>Nenhuma variável.</CommandEmpty>
                                                                <CommandGroup heading="Contato">
                                                                    {['nome', 'username'].map(v => (
                                                                        <CommandItem key={v} onSelect={() => {
                                                                            const currentMsg = (selectedNode.data as any).content?.message || '';
                                                                            updateNodeData(selectedNode.id, {
                                                                                content: { ...(selectedNode.data as any).content, message: currentMsg + ` {${v}}` }
                                                                            });
                                                                        }}>
                                                                            {v.charAt(0).toUpperCase() + v.slice(1)}
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                            <Textarea
                                                className="min-h-[120px] bg-slate-50 border-slate-200"
                                                placeholder="Digite sua mensagem..."
                                                value={(selectedNode.data as any).content?.message || ''}
                                                onChange={(e) => updateNodeData(selectedNode.id, {
                                                    content: { ...(selectedNode.data as any).content, message: e.target.value }
                                                })}
                                            />
                                        </div>
                                    )}

                                    {/* Image Config (Only for Message) */}
                                    {selectedNode.type === 'instagram' && (
                                        <div className="space-y-3 pt-6 border-t border-slate-100">
                                            <label className="text-sm font-medium text-slate-700">Imagem</label>
                                            <Tabs defaultValue={(selectedNode.data as any).content?.imageUrl?.includes('supabase') ? 'upload' : 'url'}>
                                                <TabsList className="grid w-full grid-cols-2 bg-slate-100">
                                                    <TabsTrigger value="url">URL Externa</TabsTrigger>
                                                    <TabsTrigger value="upload">Upload</TabsTrigger>
                                                </TabsList>
                                                <TabsContent value="url">
                                                    <Input
                                                        className="bg-slate-50"
                                                        placeholder="https://..."
                                                        value={(selectedNode.data as any).content?.imageUrl || ''}
                                                        onChange={(e) => updateNodeData(selectedNode.id, {
                                                            content: { ...(selectedNode.data as any).content, imageUrl: e.target.value }
                                                        })}
                                                    />
                                                </TabsContent>
                                                <TabsContent value="upload">
                                                    <div className="flex flex-col gap-3">
                                                        <Input
                                                            type="file"
                                                            accept="image/*"
                                                            className="cursor-pointer bg-slate-50"
                                                            onChange={async (e) => {
                                                                const file = e.target.files?.[0];
                                                                if (!file) return;
                                                                const formData = new FormData();
                                                                formData.append("file", file);
                                                                toast.promise(
                                                                    async () => {
                                                                        const res = await fetch('/api/upload', { method: 'POST', body: formData });
                                                                        const data = await res.json();
                                                                        if (!res.ok) throw new Error(data.error || 'Erro no upload');
                                                                        return data;
                                                                    },
                                                                    {
                                                                        loading: 'Enviando imagem...',
                                                                        success: (data) => {
                                                                            updateNodeData(selectedNode.id, {
                                                                                content: { ...(selectedNode.data as any).content, imageUrl: data.url }
                                                                            });
                                                                            return 'Imagem enviada com sucesso!';
                                                                        },
                                                                        error: (err) => `${err.message}`
                                                                    }
                                                                );
                                                            }}
                                                        />
                                                        {(selectedNode.data as any).content?.imageUrl && (
                                                            <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-slate-100">
                                                                <img src={(selectedNode.data as any).content?.imageUrl} className="h-full w-full object-contain" />
                                                                <Button
                                                                    variant="destructive" size="icon" className="absolute top-2 right-2 h-6 w-6"
                                                                    onClick={() => updateNodeData(selectedNode.id, {
                                                                        content: { ...(selectedNode.data as any).content, imageUrl: '' }
                                                                    })}
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </TabsContent>
                                            </Tabs>
                                        </div>
                                    )}

                                    {/* Buttons Config (Only for Message) */}
                                    {selectedNode.type === 'instagram' && (
                                        <div className="pt-6 border-t border-slate-100 space-y-4">
                                            <label className="text-sm font-medium text-slate-700">Botões</label>
                                            {((selectedNode.data as any).content?.buttons || []).map((btn: any, index: number) => (
                                                <div key={index} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3 relative group">
                                                    <Button
                                                        variant="ghost" size="icon"
                                                        className="absolute top-2 right-2 h-6 w-6 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100"
                                                        onClick={() => {
                                                            const b = [...((selectedNode.data as any).content?.buttons || [])];
                                                            b.splice(index, 1);
                                                            updateNodeData(selectedNode.id, { content: { ...(selectedNode.data as any).content, buttons: b } });
                                                        }}
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                    <Input
                                                        placeholder="Nome do botão"
                                                        value={btn.label || ''}
                                                        onChange={(e) => {
                                                            const b = [...((selectedNode.data as any).content?.buttons || [])];
                                                            b[index] = { ...b[index], label: e.target.value };
                                                            updateNodeData(selectedNode.id, { content: { ...(selectedNode.data as any).content, buttons: b } });
                                                        }}
                                                    />
                                                    <Input
                                                        className="text-xs h-8"
                                                        placeholder="https://..."
                                                        value={btn.url || ''}
                                                        onChange={(e) => {
                                                            const b = [...((selectedNode.data as any).content?.buttons || [])];
                                                            b[index] = { ...b[index], url: e.target.value };
                                                            updateNodeData(selectedNode.id, { content: { ...(selectedNode.data as any).content, buttons: b } });
                                                        }}
                                                    />
                                                </div>
                                            ))}
                                            {((selectedNode.data as any).content?.buttons?.length || 0) < 3 && (
                                                <Button
                                                    variant="outline"
                                                    className="w-full border-dashed"
                                                    onClick={() => {
                                                        const b = [...((selectedNode.data as any).content?.buttons || [])];
                                                        b.push({ label: '', url: '', type: 'web_url' });
                                                        updateNodeData(selectedNode.id, { content: { ...(selectedNode.data as any).content, buttons: b } });
                                                    }}
                                                >
                                                    <Plus className="w-4 h-4 mr-2" /> Adicionar botão
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}

                            {/* DELAY CONFIG */}
                            {selectedNode.type === 'delay' && (
                                <div className="space-y-4">
                                    <label className="text-sm font-medium text-slate-700">Tempo de espera</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input
                                            type="number"
                                            value={parseInt((selectedNode.data as any).time) || 1}
                                            onChange={(e) => {
                                                const currentUnit = (selectedNode.data as any).time?.split(' ')?.[1];
                                                // Normalize unit if needed or default to minuto(s)
                                                let unit = currentUnit || 'minuto(s)';
                                                if (!unit.includes('(')) unit = unit + '(s)'; // Simple fix for legacy data

                                                updateNodeData(selectedNode.id, { time: `${e.target.value} ${unit}` });
                                            }}
                                        />
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={(selectedNode.data as any).time?.split(' ')?.[1]?.replace(/^(hora|minuto|dia|segundo)$/, '$1(s)') || 'minuto(s)'}
                                            onChange={(e) => {
                                                const val = parseInt((selectedNode.data as any).time) || 1;
                                                updateNodeData(selectedNode.id, { time: `${val} ${e.target.value}` });
                                            }}
                                        >
                                            <option value="segundo(s)">Segundo(s)</option>
                                            <option value="minuto(s)">Minuto(s)</option>
                                            <option value="hora(s)">Hora(s)</option>
                                            <option value="dia(s)">Dia(s)</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* TAG CONFIG */}
                            {selectedNode.type === 'tag' && (
                                <div className="space-y-4">
                                    <label className="text-sm font-medium text-slate-700">Gerenciar Etiquetas</label>
                                    <div className="space-y-2">
                                        {((selectedNode.data as any).tags || []).map((tag: string, i: number) => (
                                            <div key={i} className="flex gap-2">
                                                <Input
                                                    value={tag}
                                                    onChange={(e) => {
                                                        const t = [...((selectedNode.data as any).tags || [])];
                                                        t[i] = e.target.value;
                                                        updateNodeData(selectedNode.id, { tags: t });
                                                    }}
                                                />
                                                <Button
                                                    variant="ghost" size="icon"
                                                    onClick={() => {
                                                        const t = [...((selectedNode.data as any).tags || [])];
                                                        t.splice(i, 1);
                                                        updateNodeData(selectedNode.id, { tags: t });
                                                    }}
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </Button>
                                            </div>
                                        ))}
                                        <Button
                                            variant="outline"
                                            className="w-full"
                                            onClick={() => {
                                                const t = [...((selectedNode.data as any).tags || [])];
                                                t.push('NOVA_TAG');
                                                updateNodeData(selectedNode.id, { tags: t });
                                            }}
                                        >
                                            <Plus className="w-4 h-4 mr-2" /> Adicionar Tag
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* CONDITION CONFIG */}
                            {selectedNode.type === 'condition' && (
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Tipo de Campo</label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm bg-slate-50"
                                            value={(selectedNode.data as any).condition?.field || 'tag'}
                                            onChange={(e) => updateNodeData(selectedNode.id, {
                                                condition: { ...(selectedNode.data as any).condition, field: e.target.value }
                                            })}
                                        >
                                            <option value="tag">Etiqueta</option>
                                            <option value="custom_field">Campo Personalizado</option>
                                            <option value="follower_status">Status de Seguidor</option>
                                            <option value="contact_score">Pontuação do Contato</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Operação</label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm bg-slate-50"
                                            value={(selectedNode.data as any).condition?.operator || 'has_tag'}
                                            onChange={(e) => updateNodeData(selectedNode.id, {
                                                condition: { ...(selectedNode.data as any).condition, operator: e.target.value }
                                            })}
                                        >
                                            <option value="has_tag">Tem etiqueta</option>
                                            <option value="not_has_tag">Não tem etiqueta</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Etiqueta</label>
                                        <Input
                                            className="bg-slate-50"
                                            placeholder="Ex: REELS GERAL"
                                            value={(selectedNode.data as any).condition?.value || ''}
                                            onChange={(e) => updateNodeData(selectedNode.id, {
                                                condition: { ...(selectedNode.data as any).condition, value: e.target.value }
                                            })}
                                        />
                                        <p className="text-[10px] text-slate-400">
                                            Digite exatamente o nome da etiqueta (Tag) que deseja verificar.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}
