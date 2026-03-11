"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
    ArrowLeft, GitBranch, Trash2, Power, PowerOff, Users, Clock, Loader2, Link2, ExternalLink
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"

import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    Edge,
    Node,
    MarkerType,
    ConnectionLineType,
    ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import dagre from 'dagre';
import BroadcastNode from "../components/BroadcastNode";
import StartNode from "../components/nodes/StartNode";
import ConditionNode from "../components/nodes/ConditionNode";
import DelayNode from "../components/nodes/DelayNode";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FlowButton {
    id?: string
    label: string
    actionType: string
    value?: string
}

interface FlowAction {
    id: string
    type: string
    payload: {
        message?: string
        buttons?: FlowButton[]
    }
    order: number
}

interface FlowRule {
    id: string
    name: string
    isActive: boolean
    triggerType: string
    triggerConfig: any
    actions: FlowAction[]
    createdAt: string
    page?: { pageName: string; pageId: string } | null
}

const nodeTypes = {
    broadcastNode: BroadcastNode,
    startNode: StartNode,
    conditionNode: ConditionNode,
    delayNode: DelayNode,
};

// ─── Dagre Auto Layout ────────────────────────────────────────────────────────

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
    const isHorizontal = direction === 'LR';
    dagreGraph.setGraph({ rankdir: direction, nodesep: 100, ranksep: 100 });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: 360, height: 200 }); // Estimativa de tamanho do nosso BroadcastNode
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        const targetX = nodeWithPosition.x - 360 / 2;
        const targetY = nodeWithPosition.y - 200 / 2;

        node.position = { x: targetX, y: targetY };
    });

    return { nodes, edges };
};

// ─── Main Component ──────────────────────────────────────────────────────────

function FlowCanvas({ params }: { params: { id: string } }) {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [toggling, setToggling] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)

    const [rootData, setRootData] = useState<FlowRule | null>(null)

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    const [pages, setPages] = useState<any[]>([])
    const [selectedPageId, setSelectedPageId] = useState<string>('')
    const [updatingPage, setUpdatingPage] = useState(false)

    useEffect(() => {
        fetch('/api/messenger/status')
            .then(r => r.json())
            .then(data => {
                setPages(data.accounts || [])
            })
            .catch(e => console.error("Erro ao carregar páginas"))
    }, [])


    // ─── Build Graph ─────────────────────────────────────────────────────────
    const buildGraph = useCallback((root: FlowRule, children: FlowRule[], stats: Record<string, number>) => {
        // 1. Try to load from saved canvas state if available
        if (root.triggerConfig?.canvas) {
            const { nodes: savedNodes = [], edges: savedEdges = [] } = root.triggerConfig.canvas;

            // Map stats to nodes
            const updatedNodes = (savedNodes || []).map((n: Node) => ({
                ...n,
                data: {
                    ...n.data,
                    stats: stats[n.id] || 0,
                    // Ensure isRoot is consistent
                    isRoot: n.id === root.triggerConfig?.nodeId || n.type === 'startNode'
                }
            }));

            setNodes(updatedNodes);
            setEdges(savedEdges);
            return;
        }

        // 2. Fallback: Manual reconstruction for old flows
        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];

        const rulesList = [root, ...children].filter(Boolean);

        rulesList.forEach(rule => {
            const action = rule.actions?.find(a => a.type === 'MESSAGE_WITH_BUTTONS');
            const message = action?.payload?.message || '';
            let buttons = action?.payload?.buttons || [];

            buttons = buttons.map((b, i) => ({ ...b, id: b.id || `btn_${rule.id}_${i}` }));

            const isRootNode = rule.id === root.id;

            newNodes.push({
                id: rule.id,
                type: 'broadcastNode',
                position: { x: 0, y: 0 },
                data: {
                    id: rule.id,
                    isRoot: isRootNode,
                    name: rule.name,
                    message: message,
                    buttons: buttons,
                    stats: stats[rule.id] || 0
                }
            });

            buttons.forEach(btn => {
                if (btn.actionType === 'flow_jump' && btn.value) {
                    newEdges.push({
                        id: `e_${rule.id}_${btn.value}`,
                        source: rule.id,
                        target: btn.value,
                        sourceHandle: btn.id,
                        type: 'smoothstep',
                        animated: true,
                        style: { stroke: '#0084FF', strokeWidth: 2 },
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#0084FF' },
                    });
                }
            });
        });

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges);
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
    }, [setNodes, setEdges]);

    // ─── Load Data ─────────────────────────────────────────────────────────────
    useEffect(() => {
        const fetchFlow = async () => {
            try {
                const res = await fetch(`/api/workflows/${params.id}`)
                if (res.ok) {
                    const data = await res.json()
                    setRootData(data.root)
                    if (data.root?.page?.pageId) {
                        setSelectedPageId(data.root.page.pageId)
                    }
                    buildGraph(data.root, data.children || [], data.stats || {})
                } else if (res.status === 404) {
                    toast.error("Flow não encontrado")
                    router.push('/workflows')
                }
            } catch (e) {
                console.error(e)
                toast.error("Erro ao carregar flow")
            } finally {
                setLoading(false)
            }
        }
        fetchFlow()
    }, [params.id, buildGraph, router])


    // ─── Actions ──────────────────────────────────────────────────────────────
    const handleToggle = async () => {
        if (!rootData) return
        setToggling(true)
        try {
            const res = await fetch(`/api/workflows/${params.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !rootData.isActive })
            })
            if (res.ok) {
                const data = await res.json()
                setRootData(prev => prev ? { ...prev, isActive: data.isActive } : prev)
                toast.success(data.isActive ? "Flow ativado!" : "Flow pausado!")
            } else {
                toast.error("Erro ao alterar status")
            }
        } catch (e) {
            toast.error("Erro de conexão")
        } finally {
            setToggling(false)
        }
    }

    const handleDelete = async () => {
        if (!confirmDelete) {
            setConfirmDelete(true)
            return
        }
        setDeleting(true)
        try {
            const res = await fetch(`/api/workflows/${params.id}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                toast.success("Flow excluído com sucesso!")
                router.push('/workflows')
            } else {
                toast.error("Erro ao excluir flow")
            }
        } catch (e) {
            toast.error("Erro de conexão")
        } finally {
            setDeleting(false)
        }
    }

    const handleChangePage = async (pageId: string) => {
        setUpdatingPage(true)
        try {
            const res = await fetch(`/api/workflows/${params.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pageId })
            })
            if (res.ok) {
                const data = await res.json()
                const newPage = pages.find(p => p.pageId === data.pageId)
                setRootData(prev => prev ? { ...prev, page: { pageId: data.pageId, pageName: newPage?.pageName || '' } } : prev)
                setSelectedPageId(data.pageId)
                toast.success("Página atualizada!")
            } else {
                toast.error("Erro ao atualizar página")
            }
        } catch (e) {
            toast.error("Erro de conexão")
        } finally {
            setUpdatingPage(false)
        }
    }

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#0084FF] animate-spin" />
            </div>
        )
    }

    if (!rootData) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <GitBranch className="w-12 h-12 text-zinc-600" />
                <h3 className="text-lg text-white font-medium">Flow não encontrado</h3>
                <Button variant="outline" onClick={() => router.push('/workflows')}>
                    Voltar à lista
                </Button>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-screen -m-6"> {/* Negative margin assuming generic layout padding */}
            {/* Header Absolute/Fixed on Top of Canvas */}
            <div className="flex items-center justify-between px-6 py-4 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 z-10">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>

                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-[#0084FF]/20 flex items-center justify-center">
                            <GitBranch className="w-4 h-4 text-[#0084FF]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white leading-none">{rootData.name}</h2>
                            <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-1">
                                {rootData.page && (
                                    <span className="flex items-center gap-1">
                                        <Users className="w-3 h-3" /> {rootData.page.pageName}
                                    </span>
                                )}
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {format(new Date(rootData.createdAt), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 mr-2">
                        <span className="text-xs text-zinc-400">Página:</span>
                        <select
                            className="bg-zinc-900 border border-zinc-800 text-xs rounded-md px-2 py-1.5 text-zinc-200 outline-none w-40"
                            value={selectedPageId}
                            disabled={updatingPage}
                            onChange={e => handleChangePage(e.target.value)}
                        >
                            <option value="" disabled>Selecione...</option>
                            {pages.map(p => (
                                <option key={p.id} value={p.pageId}>{p.pageName}</option>
                            ))}
                        </select>
                    </div>

                    {/* Status Badge */}
                    <div className={cn(
                        "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border mr-2",
                        rootData.isActive
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : "bg-zinc-800 text-zinc-400 border-zinc-700"
                    )}>
                        <div className={cn("w-1.5 h-1.5 rounded-full", rootData.isActive ? "bg-emerald-500" : "bg-zinc-500")} />
                        {rootData.isActive ? 'Ativo (Loop 24h)' : 'Pausado'}
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        disabled={toggling}
                        onClick={handleToggle}
                        className={cn(
                            "gap-2 border",
                            rootData.isActive ? "hover:text-red-400 hover:bg-red-400/10 hover:border-red-400/20" : "hover:text-emerald-400 hover:bg-emerald-400/10 hover:border-emerald-400/20"
                        )}
                    >
                        {rootData.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                        {rootData.isActive ? 'Pausar' : 'Ativar'}
                    </Button>

                    <Button
                        variant={confirmDelete ? "destructive" : "outline"}
                        size="sm"
                        disabled={deleting}
                        onClick={handleDelete}
                        onMouseLeave={() => setConfirmDelete(false)}
                        className={cn("gap-2", !confirmDelete && "border-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20")}
                    >
                        {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        {confirmDelete ? 'Confirmar' : 'Excluir'}
                    </Button>
                </div>
            </div>

            {/* Canvas Area */}
            <div className="flex-1 w-full h-full relative bg-zinc-950">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    connectionLineType={ConnectionLineType.SmoothStep}
                    fitView
                    minZoom={0.2}
                    className="dark"
                    proOptions={{ hideAttribution: true }}
                >
                    <Background color="#27272a" gap={24} size={1} />
                    <Controls className="bg-zinc-900 border-zinc-800 fill-white" />
                    <MiniMap
                        nodeColor={(n) => {
                            if (n.data?.isRoot) return '#0084FF';
                            return '#27272a';
                        }}
                        maskColor="rgba(0, 0, 0, 0.4)"
                        style={{ backgroundColor: '#09090b' }}
                        className="border border-zinc-800 rounded-lg overflow-hidden"
                    />
                </ReactFlow>

                <div className="absolute bottom-6 left-6 max-w-sm">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-xl">
                        <h4 className="text-sm font-semibold text-white mb-2">💡 Legenda Explicativa</h4>
                        <ul className="space-y-2 text-xs text-zinc-400">
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-[#0084FF]"></span>
                                O botão azul direciona para outra Mensagem (FLOW_JUMP)
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-[#25D366]"></span>
                                O botão verde direciona para fora (Abre URL num Site)
                            </li>
                            <li className="flex items-center gap-2 mt-3">
                                <span className="p-1 rounded bg-black/40"><Users className="w-3 h-3 text-zinc-300" /></span>
                                Representa o número de cliques ou recebimentos nesta Etapa.
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function Page(props: any) {
    return (
        <ReactFlowProvider>
            <FlowCanvas {...props} />
        </ReactFlowProvider>
    );
}
