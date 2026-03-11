"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    ArrowLeft, Save, Loader2, RefreshCw
} from "lucide-react"
import { toast } from "sonner"
import dagre from 'dagre'

import {
    ReactFlow,
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    Edge,
    Node,
    MarkerType,
    ConnectionLineType,
    ReactFlowProvider,
    Panel,
    Connection,
    addEdge,
    useReactFlow,
    NodeMouseHandler
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import BroadcastNode from "../components/BroadcastNode";
import DelayNode from "../components/nodes/DelayNode";
import ConditionNode from "../components/nodes/ConditionNode";
import StartNode from "../components/nodes/StartNode";
import Sidebar from "../components/Sidebar";
import PropertiesPanel from "../components/PropertiesPanel";

// ─── Types & Constants ────────────────────────────────────────────────────────

const nodeTypes = {
    broadcastNode: BroadcastNode,
    delayNode: DelayNode,
    conditionNode: ConditionNode,
    startNode: StartNode,
};

const genId = () => `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
const genBtnId = () => `btn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

const initialNodes: Node[] = [
    {
        id: 'trigger',
        type: 'startNode',
        position: { x: 50, y: 250 },
        data: {
            id: 'trigger',
            name: 'Gatilho Principal',
            triggerType: 'Mensagem no Messenger'
        }
    },
    {
        id: 'root',
        type: 'broadcastNode',
        position: { x: 400, y: 150 },
        data: {
            id: 'root',
            isRoot: false,
            name: 'Primeira Mensagem',
            message: 'Olá {{first_name}}! \n\nTenho algumas opções para você:',
            buttons: [
                { id: genBtnId(), label: 'Ver Cursos', targetNodeId: null, actionType: 'flow_jump' },
                { id: genBtnId(), label: 'Ver Empregos', targetNodeId: null, actionType: 'flow_jump' },
            ],
            stats: 0
        },
    },
];

const initialEdges: Edge[] = [
    {
        id: 'e_trigger_root',
        source: 'trigger',
        target: 'root',
        type: 'default',
        animated: true,
        style: { stroke: '#10b981', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
    }
];

// ─── Dagre Auto Layout ────────────────────────────────────────────────────────

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: direction, nodesep: 60, ranksep: 100 });

    nodes.forEach((node) => {
        let width = 360;
        let height = 200;

        if (node.type === 'delayNode') { width = 300; height = 100; }
        if (node.type === 'conditionNode') { width = 300; height = 150; }
        if (node.type === 'startNode') { width = 260; height = 80; }

        dagreGraph.setNode(node.id, { width, height });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        let width = 360;
        let height = 200;

        if (node.type === 'delayNode') { width = 300; height = 100; }
        if (node.type === 'conditionNode') { width = 300; height = 150; }
        if (node.type === 'startNode') { width = 260; height = 80; }

        node.position = {
            x: nodeWithPosition.x - width / 2,
            y: nodeWithPosition.y - height / 2
        };
    });

    return { nodes, edges };
};

// ─── Main Builder Content ─────────────────────────────────────────────────────

function FlowBuilderContent() {
    const router = useRouter()
    const { screenToFlowPosition, setViewport } = useReactFlow();
    const [name, setName] = useState("Nova Regra")
    const [saving, setSaving] = useState(false)
    const [pages, setPages] = useState<any[]>([])
    const [selectedPageId, setSelectedPageId] = useState<string>('')
    const reactFlowWrapper = useRef<HTMLDivElement>(null);

    // Flow State
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);

    // UI State
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/messenger/status')
            .then(r => r.json())
            .then(data => {
                setPages(data.accounts || [])
                if (data.accounts?.length > 0) setSelectedPageId(data.accounts[0].pageId)
            })
            .catch(() => toast.error("Erro ao carregar páginas"))
    }, [])

    // ─── Drag and Drop Handlers ───────────────────────────────────────────────

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');
            const label = event.dataTransfer.getData('application/reactflow-label');

            if (typeof type === 'undefined' || !type) return;

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const newNodeId = genId();
            let dataObj: any = { id: newNodeId, name: label };

            if (type === 'messageNode' || type === 'broadcastNode') {
                dataObj = {
                    ...dataObj,
                    isRoot: false,
                    message: 'Digite sua mensagem...',
                    buttons: [{ id: genBtnId(), label: 'Continuar', actionType: 'flow_jump' }],
                    stats: 0
                }
            } else if (type === 'delayNode') {
                dataObj = { ...dataObj, delayAmount: 1, delayUnit: 'Minutos' }
            } else if (type === 'conditionNode') {
                dataObj = { ...dataObj, conditionText: 'IF HasTag(Lead)' }
            }

            const newNode: Node = {
                id: newNodeId,
                type: type === 'messageNode' ? 'broadcastNode' : type,
                position,
                data: dataObj,
            };

            setNodes((nds) => nds.concat(newNode));

            // Auto select
            setTimeout(() => setSelectedNodeId(newNodeId), 50);
        },
        [screenToFlowPosition, setNodes]
    );

    // ─── Interaction Handlers ────────────────────────────────────────────────

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge({
            ...params,
            type: 'default',
            animated: true,
            style: { stroke: '#0084FF', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#0084FF' },
        }, eds)),
        [setEdges]
    );

    const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
        setSelectedNodeId(node.id);
    }, []);

    const onPaneClick = useCallback(() => {
        setSelectedNodeId(null);
    }, []);

    const handleUpdateNode = useCallback((nodeId: string, newData: any) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    return { ...node, data: newData };
                }
                return node;
            })
        );
    }, [setNodes]);

    const handleDeleteNode = useCallback((nodeId: string) => {
        setNodes((nds) => nds.filter((node) => node.id !== nodeId));
        setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
        setSelectedNodeId(null);
    }, [setNodes, setEdges]);

    const onLayout = useCallback(() => {
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements([...nodes], [...edges]);
        setNodes([...layoutedNodes]);
        setEdges([...layoutedEdges]);
        setViewport({ x: 250, y: 100, zoom: 0.8 }, { duration: 800 });
    }, [nodes, edges, setNodes, setEdges, setViewport]);


    // ─── Save Action ─────────────────────────────────────────────────────────

    const handleSave = async () => {
        if (!name.trim()) return toast.error("Dê um nome ao fluxo")
        if (!selectedPageId) return toast.error("Selecione uma página do Facebook")

        setSaving(true)
        try {
            const res = await fetch('/api/workflows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    pageId: selectedPageId,
                    nodes: nodes.map(n => ({
                        id: n.id,
                        type: n.type,
                        position: n.position,
                        data: n.data,
                        isRoot: n.id === 'root' || n.type === 'startNode'
                    })),
                    edges: edges
                })
            })

            if (res.ok) {
                toast.success("Regra salva com sucesso!")
                setTimeout(() => router.push('/workflows'), 1000)
            } else {
                const data = await res.json()
                toast.error("Erro: " + (data.error || "ao salvar a regra"), { id: 'save' })
            }
        } catch (e) {
            console.error(e)
            toast.error("Erro interno ao enviar para o servidor", { id: 'save' })
        } finally {
            setSaving(false)
        }
    }

    const selectedNodeObj = nodes.find(n => n.id === selectedNodeId) || null;

    return (
        <div className="flex h-screen -m-6 relative overflow-hidden bg-zinc-950">
            {/* Left Sidebar */}
            <div className="h-full pt-[73px] z-20 absolute left-0 w-64 border-r border-zinc-800 bg-zinc-950">
                <Sidebar />
            </div>

            {/* Right Properties Panel */}
            {selectedNodeObj && (
                <div className="h-full pt-[73px] z-20 absolute right-0 w-80 border-l border-zinc-800 bg-zinc-950 shadow-2xl">
                    <PropertiesPanel
                        selectedNode={selectedNodeObj}
                        onUpdateNode={handleUpdateNode}
                        onDeleteNode={handleDeleteNode}
                        onClose={() => setSelectedNodeId(null)}
                    />
                </div>
            )}

            {/* Header Absolute */}
            <div className="flex items-center justify-between px-6 py-4 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 z-50 absolute top-0 left-0 right-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0 text-zinc-400 hover:text-white">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex flex-col">
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="bg-transparent border-none text-lg font-bold text-white focus:outline-none focus:ring-0 p-0 placeholder-zinc-600 h-6"
                            placeholder="Nome do Fluxo..."
                        />
                        <span className="text-xs text-emerald-500 flex items-center gap-1 font-medium tracking-wide">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Modo de Edição Visual
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400">Página:</span>
                        <select
                            className="bg-zinc-900 border border-zinc-800 text-sm rounded-md px-3 py-1.5 text-zinc-200 outline-none w-48"
                            value={selectedPageId}
                            onChange={e => setSelectedPageId(e.target.value)}
                        >
                            <option value="" disabled>Selecione...</option>
                            {pages.map(p => (
                                <option key={p.id} value={p.pageId}>{p.pageName}</option>
                            ))}
                        </select>
                    </div>
                    <Button onClick={onLayout} variant="outline" className="border-zinc-700 hover:bg-zinc-800 text-zinc-300">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Organizar Layout
                    </Button>
                    <Button onClick={handleSave} disabled={saving} className="bg-[#0084FF] hover:bg-[#0070D1] text-white font-medium shadow-lg shadow-[#0084FF]/20 px-6">
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Salvar Rascunho
                    </Button>
                </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 w-full h-full pt-[73px] ml-64" ref={reactFlowWrapper}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodesDelete={(deletedNodes) => {
                        if (deletedNodes.some(n => n.id === selectedNodeId)) {
                            setSelectedNodeId(null);
                        }
                    }}
                    onConnect={onConnect}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onNodeClick={onNodeClick}
                    onPaneClick={onPaneClick}
                    nodeTypes={nodeTypes}
                    connectionLineType={ConnectionLineType.SmoothStep}
                    fitView
                    minZoom={0.1}
                    className="dark"
                    proOptions={{ hideAttribution: true }}
                    deleteKeyCode={["Backspace", "Delete"]}
                >
                    <Background color="#27272a" gap={24} size={1} />
                    <Controls className="bg-zinc-900 border-zinc-800 fill-white" />

                    <Panel position="bottom-center" className="bg-black/80 backdrop-blur border border-zinc-500/30 text-white px-4 py-2 rounded-full text-xs font-medium shadow-2xl flex items-center gap-2 mb-4">
                        Arraste blocos da barra lateral para cá. Clique em um bloco para editá-lo à direita.
                    </Panel>
                </ReactFlow>
            </div>
        </div>
    )
}

export default function BroadcastCreatePage() {
    return (
        <ReactFlowProvider>
            <FlowBuilderContent />
        </ReactFlowProvider>
    )
}
