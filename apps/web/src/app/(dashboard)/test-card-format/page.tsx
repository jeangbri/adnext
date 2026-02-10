"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { Loader2, Send, Eye } from "lucide-react"
import { CARD_FORMAT_CONFIGS, type CardFormat } from "@/lib/types/card-format"

export default function CardFormatTestPage() {
    const [imageUrl, setImageUrl] = useState("")
    const [cardFormat, setCardFormat] = useState<CardFormat>("SQUARE")
    const [cropMode, setCropMode] = useState<"NONE" | "AUTO_CENTER_CROP">("NONE")
    const [derivedUrl, setDerivedUrl] = useState("")
    const [title, setTitle] = useState("Produto Teste")
    const [subtitle, setSubtitle] = useState("Descrição do card")
    const [deriving, setDeriving] = useState(false)
    const [sending, setSending] = useState(false)
    const [logs, setLogs] = useState<string[]>([])

    const addLog = (msg: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev])
    }

    const handleDerive = async () => {
        if (!imageUrl) { toast.error("Adicione uma URL de imagem"); return }
        setDeriving(true)
        addLog(`Derivando imagem para ${cardFormat}...`)
        try {
            const res = await fetch("/api/card-image/derive", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageUrl, cardFormat }),
            })
            const data = await res.json()
            if (res.ok) {
                setDerivedUrl(data.derivedUrl)
                addLog(`✓ Derivada OK: ${data.width}×${data.height} → ${data.derivedUrl}`)
                toast.success("Imagem derivada com sucesso!")
            } else {
                addLog(`✗ Erro: ${data.error}`)
                toast.error(data.error)
            }
        } catch (e: any) {
            addLog(`✗ Erro: ${e.message}`)
        } finally {
            setDeriving(false)
        }
    }

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const formData = new FormData()
        formData.append("file", file)
        try {
            const res = await fetch("/api/upload", { method: "POST", body: formData })
            const data = await res.json()
            if (res.ok) {
                setImageUrl(data.url)
                setDerivedUrl("")
                addLog(`Upload OK: ${data.url}`)
                toast.success("Upload concluído!")
            } else {
                toast.error(data.error)
            }
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    const getSentUrl = () => {
        return (cropMode === "AUTO_CENTER_CROP" && derivedUrl) ? derivedUrl : imageUrl
    }

    const formatConfigs = Object.entries(CARD_FORMAT_CONFIGS) as [CardFormat, typeof CARD_FORMAT_CONFIGS.SQUARE][]

    return (
        <div className="min-h-screen bg-zinc-950 text-white p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">🧪 Teste de Formato do Card</h1>
                    <p className="text-sm text-zinc-400 mt-1">Preview comparativo de todos os formatos + envio de teste</p>
                </div>

                {/* Controls */}
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-sm">Configuração</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs">URL da Imagem</Label>
                                <div className="flex gap-2">
                                    <Input
                                        className="h-8 bg-black/40 border-zinc-800 text-xs flex-1"
                                        value={imageUrl}
                                        onChange={e => { setImageUrl(e.target.value); setDerivedUrl("") }}
                                        placeholder="https://..."
                                    />
                                    <label className="cursor-pointer">
                                        <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                                            <span>Upload</span>
                                        </Button>
                                        <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                                    </label>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs">Formato</Label>
                                <Select value={cardFormat} onValueChange={v => { setCardFormat(v as CardFormat); setDerivedUrl("") }}>
                                    <SelectTrigger className="h-8 text-xs bg-black/40 border-zinc-800">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SQUARE">Quadrado (1:1)</SelectItem>
                                        <SelectItem value="PORTRAIT">Retrato (4:5)</SelectItem>
                                        <SelectItem value="LANDSCAPE">Paisagem (1.91:1)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs">Título</Label>
                                <Input className="h-8 bg-black/40 border-zinc-800 text-xs" value={title} onChange={e => setTitle(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs">Subtítulo</Label>
                                <Input className="h-8 bg-black/40 border-zinc-800 text-xs" value={subtitle} onChange={e => setSubtitle(e.target.value)} />
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Switch checked={cropMode === "AUTO_CENTER_CROP"} onCheckedChange={v => setCropMode(v ? "AUTO_CENTER_CROP" : "NONE")} />
                            <Label className="text-xs">Recorte Automático (cropMode: {cropMode})</Label>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                className="h-8 text-xs"
                                onClick={handleDerive}
                                disabled={!imageUrl || deriving}
                            >
                                {deriving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                                Derivar imagem ({CARD_FORMAT_CONFIGS[cardFormat].idealLabel})
                            </Button>
                        </div>

                        {derivedUrl && (
                            <div className="text-[10px] text-emerald-400 bg-emerald-500/10 p-2 rounded border border-emerald-500/20 break-all">
                                ✓ Derivada: {derivedUrl}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Preview in all 3 formats */}
                <div>
                    <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Eye className="w-4 h-4" /> Preview Comparativo</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {formatConfigs.map(([fmt, config]) => (
                            <Card key={fmt} className={`bg-zinc-900 border-zinc-800 ${fmt === cardFormat ? 'ring-2 ring-primary' : ''}`}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-xs">{config.label}</CardTitle>
                                    <CardDescription className="text-[10px]">{config.idealLabel}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div
                                        className="rounded-lg overflow-hidden bg-black/30 border border-zinc-800 mb-2"
                                        style={{ aspectRatio: config.cssAspectRatio }}
                                    >
                                        {imageUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={(fmt === cardFormat && derivedUrl) ? derivedUrl : imageUrl}
                                                alt={`Preview ${fmt}`}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                                                Sem imagem
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs font-medium truncate">{title || "Título"}</p>
                                    <p className="text-[10px] text-zinc-500 truncate">{subtitle || "Subtítulo"}</p>
                                    {fmt === cardFormat && (
                                        <span className="inline-block mt-1 text-[9px] bg-primary/20 text-primary px-2 py-0.5 rounded">
                                            Selecionado
                                        </span>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Send Info */}
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-sm">📤 Dados de Envio</CardTitle>
                        <CardDescription className="text-xs">O que seria enviado ao Messenger</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <pre className="text-[10px] bg-black/40 p-3 rounded border border-zinc-800 overflow-auto max-h-[200px]">
                            {JSON.stringify({
                                cardFormat,
                                cropMode,
                                sentImageUrl: getSentUrl(),
                                originalImageUrl: imageUrl,
                                derivedImageUrl: derivedUrl || null,
                                messengerPayload: {
                                    template_type: "generic",
                                    elements: [{
                                        title,
                                        subtitle,
                                        image_url: getSentUrl(),
                                    }]
                                }
                            }, null, 2)}
                        </pre>
                    </CardContent>
                </Card>

                {/* Logs */}
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-sm">📋 Log</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-1 max-h-[200px] overflow-auto">
                            {logs.length === 0 && <p className="text-xs text-zinc-600">Nenhum log ainda</p>}
                            {logs.map((log, i) => (
                                <p key={i} className="text-[10px] text-zinc-400 font-mono">{log}</p>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
