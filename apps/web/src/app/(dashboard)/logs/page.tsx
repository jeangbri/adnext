"use client"

import { useEffect, useState, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

type LogEntry = {
    id: string
    type: string
    direction: string
    source: string
    content: string
    status: string
    error: string | null
    createdAt: string
    pageName: string
    contactName: string
}

export default function LogsPage() {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [loading, setLoading] = useState(true)

    const fetchLogs = useCallback(async () => {
        try {
            const res = await fetch('/api/logs')
            if (res.ok) {
                const data = await res.json()
                setLogs(data)
            }
        } catch (e) {
            console.error("Failed to load logs", e)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchLogs()
    }, [fetchLogs])

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Logs & Eventos</h1>
                    <p className="text-muted-foreground">Histórico unificado de mensagens e comentários.</p>
                </div>
            </div>

            <div className="border border-white/10 rounded-lg bg-zinc-950/50 backdrop-blur overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-900/50 text-zinc-400 font-medium border-b border-white/5">
                        <tr>
                            <th className="px-6 py-4">Data</th>
                            <th className="px-6 py-4">Página</th>
                            <th className="px-6 py-4">Origem</th>
                            <th className="px-6 py-4">Tipo</th>
                            <th className="px-6 py-4">Conteúdo</th>
                            <th className="px-6 py-4">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-zinc-300">
                        {loading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <tr key={i}>
                                    <td className="px-6 py-4"><Skeleton className="h-3 w-28 bg-zinc-800" /></td>
                                    <td className="px-6 py-4"><Skeleton className="h-3 w-20 bg-zinc-800" /></td>
                                    <td className="px-6 py-4"><Skeleton className="h-3 w-24 bg-zinc-800" /></td>
                                    <td className="px-6 py-4"><Skeleton className="h-5 w-24 rounded-full bg-zinc-800" /></td>
                                    <td className="px-6 py-4"><Skeleton className="h-3 w-40 bg-zinc-800" /></td>
                                    <td className="px-6 py-4"><Skeleton className="h-5 w-16 rounded-full bg-zinc-800" /></td>
                                </tr>
                            ))
                        ) : (
                            logs.map((log) => (
                                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-zinc-400">
                                        {new Date(log.createdAt).toLocaleString('pt-BR')}
                                    </td>
                                    <td className="px-6 py-4 text-xs">
                                        {log.pageName}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm">{log.contactName}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge variant="outline" className={`
                                            ${log.type === 'COMMENT' ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' : ''}
                                            ${log.type === 'MESSAGE' && log.direction === 'IN' ? 'text-blue-400 bg-blue-400/10 border-blue-400/20' : ''}
                                            ${log.type === 'MESSAGE' && log.direction === 'OUT' ? 'text-purple-400 bg-purple-400/10 border-purple-400/20' : ''}
                                        `}>
                                            {log.type === 'COMMENT' ? 'COMENTÁRIO' : (log.direction === 'IN' ? 'MSG RECEBIDA' : 'MSG ENVIADA')}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 max-w-xs truncate" title={log.content}>
                                        {log.content}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <Badge variant="secondary" className={
                                                log.status === 'ERROR' || log.status === 'FAILED' ? 'bg-red-500/10 text-red-500' :
                                                    log.status === 'MATCHED' || log.status === 'SENT' || log.status === 'RECEIVED' ? 'bg-green-500/10 text-green-500' :
                                                        'bg-zinc-800 text-zinc-400'
                                            }>
                                                {log.status}
                                            </Badge>
                                            {log.error && <span className="text-[10px] text-red-400 max-w-[150px] truncate">{log.error}</span>}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                {!loading && logs.length === 0 && (
                    <div className="p-12 text-center text-zinc-500">Nenhum log encontrado.</div>
                )}
            </div>
        </div>
    )
}
