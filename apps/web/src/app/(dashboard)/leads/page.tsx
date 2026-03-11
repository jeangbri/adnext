"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Phone, Users, Search, ArrowLeft, ArrowRight, Copy, CheckCircle2, Trash2, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

type Lead = {
    id: string
    firstName: string | null
    lastName: string | null
    phone: string | null
    profilePicUrl: string | null
    firstSeenAt: string
    lastSeenAt: string
    tags: string[] | null
    pageId: string | null
}

type LeadsResponse = {
    leads: Lead[]
    total: number
    page: number
    limit: number
    totalPages: number
}

function formatPhone(phone: string): string {
    // Format: +55 (11) 99999-9999
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 13) {
        return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`
    }
    if (cleaned.length === 12) {
        return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`
    }
    if (cleaned.length === 11) {
        return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`
    }
    if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`
    }
    return phone
}

function timeAgo(dateStr: string): string {
    const now = new Date()
    const date = new Date(dateStr)
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return "agora"
    if (minutes < 60) return `${minutes}min`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d`
    const months = Math.floor(days / 30)
    return `${months}m`
}

function LeadRowSkeleton() {
    return (
        <div className="flex items-center gap-4 p-4 border-b border-zinc-800/50">
            <Skeleton className="h-10 w-10 rounded-full bg-zinc-800" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32 bg-zinc-800" />
                <Skeleton className="h-3 w-48 bg-zinc-800/60" />
            </div>
            <Skeleton className="h-4 w-20 bg-zinc-800" />
        </div>
    )
}

export default function LeadsPage() {
    const [data, setData] = useState<LeadsResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [page, setPage] = useState(1)
    const [copiedId, setCopiedId] = useState<string | null>(null)

    // Filters
    const [pageIdFilter, setPageIdFilter] = useState("all")
    const [ruleIdFilter, setRuleIdFilter] = useState("all")
    const [dddFilter, setDddFilter] = useState("all")

    const [pages, setPages] = useState<any[]>([])
    const [rules, setRules] = useState<any[]>([])

    const fetchLeads = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: "30",
            })
            if (search) params.set("search", search)
            if (pageIdFilter !== "all") params.set("pageId", pageIdFilter)
            if (ruleIdFilter !== "all") params.set("ruleId", ruleIdFilter)
            if (dddFilter !== "all") params.set("ddd", dddFilter)

            const res = await fetch(`/api/leads?${params}`)
            if (res.ok) {
                const json = await res.json()
                setData(json)
            }
        } catch (e) {
            console.error("Failed to fetch leads", e)
        } finally {
            setLoading(false)
        }
    }, [page, search, pageIdFilter, ruleIdFilter, dddFilter])

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchLeads()
        }, search ? 400 : 0) // debounce search

        return () => clearTimeout(timer)
    }, [fetchLeads, search])

    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const [pagesRes, rulesRes] = await Promise.all([
                    fetch('/api/messenger/status'),
                    fetch('/api/workflows')
                ])
                if (pagesRes.ok) {
                    const pagesData = await pagesRes.json()
                    setPages(pagesData.accounts || [])
                }
                if (rulesRes.ok) {
                    const rulesData = await rulesRes.json()
                    setRules(rulesData.rules || [])
                }
            } catch (e) {
                console.error("Failed to load filters", e)
            }
        }
        fetchFilters()
    }, [])

    const handleCopy = (phone: string, leadId: string) => {
        navigator.clipboard.writeText(phone)
        setCopiedId(leadId)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const handleDelete = async (leadId: string) => {
        if (!confirm("Tem certeza que deseja excluir este contato?")) return
        try {
            const res = await fetch(`/api/leads/${leadId}`, { method: 'DELETE' })
            if (res.ok) {
                toast.success("Contato excluído com sucesso!")
                fetchLeads()
            } else {
                toast.error("Erro ao excluir contato.")
            }
        } catch (e) {
            toast.error("Erro interno ao excluir.")
        }
    }

    // Common DDDs in Brazil for filter options
    const ddds = [
        "11", "12", "13", "14", "15", "16", "17", "18", "19",
        "21", "22", "24", "27", "28", "31", "32", "33", "34", "35", "37", "38",
        "41", "42", "43", "44", "45", "46", "47", "48", "49",
        "51", "53", "54", "55", "61", "62", "63", "64", "65", "66", "67", "68", "69",
        "71", "73", "74", "75", "77", "79", "81", "82", "83", "84", "85", "86", "87", "88", "89",
        "91", "92", "93", "94", "95", "96", "97", "98", "99"
    ]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                        <Phone className="w-8 h-8 text-emerald-400" />
                        Leads Capturados
                    </h2>
                    <p className="text-zinc-400 mt-1">
                        Contatos que forneceram o número de telefone via quiz
                    </p>
                </div>
                {data && (
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2 flex items-center gap-2">
                            <Users className="w-4 h-4 text-emerald-400" />
                            <span className="text-emerald-400 font-bold text-lg">{data.total}</span>
                            <span className="text-emerald-400/70 text-sm">leads</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input
                        placeholder="Buscar por nome ou telefone..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value)
                            setPage(1)
                        }}
                        className="pl-10 bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-600 focus:ring-emerald-500/30 focus:border-emerald-500/50"
                    />
                </div>

                <div className="flex flex-wrap gap-3">
                    <div className="w-[160px]">
                        <Select value={pageIdFilter} onValueChange={(val) => { setPageIdFilter(val); setPage(1); }}>
                            <SelectTrigger className="bg-zinc-900/50 border-zinc-800 text-zinc-300">
                                <SelectValue placeholder="Página (Todas)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas as páginas</SelectItem>
                                {pages.map(p => (
                                    <SelectItem key={p.pageId} value={p.pageId}>{p.pageName || p.pageId}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="w-[160px]">
                        <Select value={ruleIdFilter} onValueChange={(val) => { setRuleIdFilter(val); setPage(1); }}>
                            <SelectTrigger className="bg-zinc-900/50 border-zinc-800 text-zinc-300">
                                <SelectValue placeholder="Regra (Todas)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas as regras</SelectItem>
                                {rules.map(r => (
                                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="w-[140px]">
                        <Select value={dddFilter} onValueChange={(val) => { setDddFilter(val); setPage(1); }}>
                            <SelectTrigger className="bg-zinc-900/50 border-zinc-800 text-zinc-300">
                                <SelectValue placeholder="DDD (Todos)" />
                            </SelectTrigger>
                            <SelectContent className="max-h-64 overflow-y-auto">
                                <SelectItem value="all">Qualquer DDD</SelectItem>
                                {ddds.map(d => (
                                    <SelectItem key={d} value={d}>DDD {d}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Leads Table */}
            <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
                <CardHeader className="border-b border-zinc-800/50">
                    <div className="grid grid-cols-12 gap-4 text-xs font-semibold uppercase tracking-wider text-zinc-500 px-4">
                        <div className="col-span-4">Contato</div>
                        <div className="col-span-3">Telefone</div>
                        <div className="col-span-2">Capturado em</div>
                        <div className="col-span-2">Última atividade</div>
                        <div className="col-span-1">Ações</div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div>
                            {Array.from({ length: 8 }).map((_, i) => (
                                <LeadRowSkeleton key={i} />
                            ))}
                        </div>
                    ) : data && data.leads.length > 0 ? (
                        <div className="divide-y divide-zinc-800/50">
                            {data.leads.map((lead) => (
                                <div
                                    key={lead.id}
                                    className="grid grid-cols-12 gap-4 items-center px-4 py-3 hover:bg-zinc-800/20 transition-colors group"
                                >
                                    {/* Contact Info */}
                                    <div className="col-span-4 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-zinc-700/50 flex items-center justify-center text-sm font-bold text-emerald-400 uppercase">
                                            {lead.profilePicUrl ? (
                                                <img
                                                    src={lead.profilePicUrl}
                                                    alt=""
                                                    className="w-10 h-10 rounded-full object-cover"
                                                />
                                            ) : (
                                                (lead.firstName?.[0] || "?")
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-white">
                                                {lead.firstName || "Sem nome"} {lead.lastName || ""}
                                            </p>
                                            {lead.tags && Array.isArray(lead.tags) && (lead.tags as string[]).length > 0 && (
                                                <div className="flex gap-1 mt-0.5">
                                                    {(lead.tags as string[]).slice(0, 2).map((tag: string) => (
                                                        <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 border-zinc-700 text-zinc-400">
                                                            {tag}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Phone */}
                                    <div className="col-span-3">
                                        {lead.phone ? (
                                            <div className="flex items-center gap-2">
                                                <Phone className="w-3.5 h-3.5 text-emerald-400/70" />
                                                <span className="text-sm text-zinc-300 font-mono">
                                                    {formatPhone(lead.phone)}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-zinc-600">—</span>
                                        )}
                                    </div>

                                    {/* First Seen */}
                                    <div className="col-span-2">
                                        <span className="text-xs text-zinc-500">
                                            {new Date(lead.firstSeenAt).toLocaleDateString('pt-BR', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: '2-digit'
                                            })}
                                        </span>
                                    </div>

                                    {/* Last Activity */}
                                    <div className="col-span-2">
                                        <span className="text-xs text-zinc-500">
                                            {timeAgo(lead.lastSeenAt)}
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div className="col-span-1 flex justify-end gap-1">
                                        {lead.phone && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 w-8 p-0 text-zinc-500 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => handleCopy(lead.phone!, lead.id)}
                                                title="Copiar telefone"
                                            >
                                                {copiedId === lead.id ? (
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                                ) : (
                                                    <Copy className="w-4 h-4" />
                                                )}
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 p-0 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => handleDelete(lead.id)}
                                            title="Excluir"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
                            <Phone className="w-12 h-12 mb-4 text-zinc-700" />
                            <p className="text-sm font-medium">Nenhum lead encontrado</p>
                            <p className="text-xs text-zinc-600 mt-1">
                                Os leads aparecerão aqui quando fornecerem o telefone no quiz
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Pagination */}
            {data && data.totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-zinc-500">
                        Mostrando {((data.page - 1) * data.limit) + 1} - {Math.min(data.page * data.limit, data.total)} de {data.total}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="border-zinc-700 text-zinc-400 hover:text-white"
                            disabled={page <= 1}
                            onClick={() => setPage(p => p - 1)}
                        >
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            Anterior
                        </Button>
                        <span className="text-sm text-zinc-500 px-2">
                            {data.page} / {data.totalPages}
                        </span>
                        <Button
                            size="sm"
                            variant="outline"
                            className="border-zinc-700 text-zinc-400 hover:text-white"
                            disabled={page >= data.totalPages}
                            onClick={() => setPage(p => p + 1)}
                        >
                            Próximo
                            <ArrowRight className="w-4 h-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
