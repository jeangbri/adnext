"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { toast } from 'sonner'

// If RadioGroup doesn't exist, I'll use standard inputs. Let's assume standard for safety if I'm not sure.
// actually check check ui components first? No, user said "Don't check unneccesarily".
// I'll use standard HTML inputs/buttons for the selector to avoid breaking if component missing.

export default function CreateWorkflowPage() {
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [channels, setChannels] = useState<{ dm: boolean, story: boolean, feed: boolean }>({
        dm: true,
        story: false,
        feed: false
    })

    // Feed Specific Config
    const [feedMode, setFeedMode] = useState<'all' | 'specific'>('all')
    const [selectedPost, setSelectedPost] = useState<{ id: string, url: string, caption?: string, thumbnail_url?: string } | null>(null)
    const [availablePosts, setAvailablePosts] = useState<any[]>([])
    const [loadingPosts, setLoadingPosts] = useState(false)
    const [showPostSelector, setShowPostSelector] = useState(false)

    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const fetchPosts = async () => {
        setLoadingPosts(true);
        try {
            const res = await fetch('/api/instagram/media');
            const json = await res.json();
            if (json.data) {
                setAvailablePosts(json.data);
            }
        } catch (e) {
            console.error(e);
            toast.error("Erro ao carregar posts");
        } finally {
            setLoadingPosts(false);
        }
    }

    // Load posts when 'specific' mode is selected
    useEffect(() => {
        if (channels.feed && feedMode === 'specific' && availablePosts.length === 0) {
            fetchPosts();
        }
    }, [channels.feed, feedMode]);

    const handleCreate = async () => {
        if (!title) {
            toast.error("O título é obrigatório");
            return;
        }

        const selectedChannels = [];
        if (channels.dm) selectedChannels.push('dm');
        if (channels.story) selectedChannels.push('story');
        if (channels.feed) selectedChannels.push('feed');

        if (selectedChannels.length === 0) {
            toast.error("Selecione pelo menos um canal");
            return;
        }

        if (channels.feed && feedMode === 'specific' && !selectedPost) {
            toast.error("Você escolheu 'Post Específico' mas não selecionou nenhum post.");
            return;
        }

        const feedConfig = (channels.feed && feedMode === 'specific' && selectedPost)
            ? { targetMediaId: selectedPost.id, targetMediaUrl: selectedPost.url }
            : {};

        setLoading(true);
        try {
            const res = await fetch('/api/workflows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    description,
                    channels: selectedChannels,
                    feedConfig
                })
            });

            if (!res.ok) throw new Error("Falha ao criar");

            const data = await res.json();
            toast.success("Automação criada!");
            router.push(`/workflows/${data.id}/editor`);
        } catch (e) {
            console.error(e);
            toast.error("Erro ao criar automação");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6 mb-20">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Criar Automação</h2>
                <p className="text-muted-foreground">Configure os detalhes iniciais do seu fluxo</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Informações Básicas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Título</Label>
                        <Input
                            id="title"
                            placeholder="Ex: Resposta de Boas-vindas"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="desc">Descrição</Label>
                        <Input
                            id="desc"
                            placeholder="Opcional"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>

                    <div className="space-y-3 pt-4 border-t">
                        <Label className="text-base">Onde a sua automação deverá funcionar?</Label>
                        <div className="grid gap-3">
                            <div className="flex items-center space-x-2">
                                <Checkbox id="dm" checked={channels.dm} onCheckedChange={(c) => setChannels(p => ({ ...p, dm: c as boolean }))} />
                                <Label htmlFor="dm">Mensagem Direta (DM)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="story" checked={channels.story} onCheckedChange={(c) => setChannels(p => ({ ...p, story: c as boolean }))} />
                                <Label htmlFor="story">Resposta à Story</Label>
                            </div>

                            {/* Feed Logic */}
                            <div className="flex flex-col space-y-2 p-3 border rounded-md bg-muted/10">
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="feed" checked={channels.feed} onCheckedChange={(c) => setChannels(p => ({ ...p, feed: c as boolean }))} />
                                    <Label htmlFor="feed" className="font-medium">Comentário no Feed</Label>
                                </div>

                                {channels.feed && (
                                    <div className="ml-6 space-y-3 mt-2 animate-in fade-in slide-in-from-top-2">
                                        <div className="flex gap-4">
                                            <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setFeedMode('all')}>
                                                <div className={`w-4 h-4 rounded-full border ${feedMode === 'all' ? 'border-primary bg-primary' : 'border-muted-foreground'}`}></div>
                                                <Label className="cursor-pointer">Qualquer Post</Label>
                                            </div>
                                            <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setFeedMode('specific')}>
                                                <div className={`w-4 h-4 rounded-full border ${feedMode === 'specific' ? 'border-primary bg-primary' : 'border-muted-foreground'}`}></div>
                                                <Label className="cursor-pointer">Post Específico</Label>
                                            </div>
                                        </div>

                                        {feedMode === 'specific' && (
                                            <div className="space-y-2">
                                                {selectedPost ? (
                                                    <div className="flex items-center gap-3 p-3 border rounded bg-background">
                                                        {/* Thumbnail */}
                                                        {selectedPost.thumbnail_url || selectedPost.url ? (
                                                            <div className="w-12 h-12 bg-gray-200 rounded overflow-hidden">
                                                                <img src={selectedPost.thumbnail_url || selectedPost.url} className="w-full h-full object-cover" alt="Post" onError={(e) => e.currentTarget.style.display = 'none'} />
                                                            </div>
                                                        ) : (
                                                            <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-xs">IMG</div>
                                                        )}
                                                        <div className="flex-1 overflow-hidden">
                                                            <p className="text-sm font-medium truncate">ID: {selectedPost.id}</p>
                                                            <p className="text-xs text-muted-foreground truncate">{selectedPost.caption || 'Sem legenda'}</p>
                                                        </div>
                                                        <Button variant="ghost" size="sm" onClick={() => setSelectedPost(null)}>Trocar</Button>
                                                    </div>
                                                ) : (
                                                    <Button variant="outline" size="sm" onClick={() => setShowPostSelector(!showPostSelector)} className="w-full">
                                                        {showPostSelector ? 'Fechar Lista' : 'Selecionar Post do Instagram'}
                                                    </Button>
                                                )}

                                                {/* Post Grid Selector */}
                                                {showPostSelector && !selectedPost && (
                                                    <div className="border rounded-md p-2 bg-background">
                                                        {loadingPosts ? (
                                                            <p className="p-4 text-center text-sm text-muted-foreground">Carregando posts...</p>
                                                        ) : (
                                                            <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                                                                {availablePosts.map(post => (
                                                                    <div
                                                                        key={post.id}
                                                                        className="relative aspect-square bg-gray-100 cursor-pointer hover:opacity-80 transition-opacity border rounded overflow-hidden"
                                                                        onClick={() => {
                                                                            setSelectedPost({
                                                                                id: post.id,
                                                                                url: post.media_url || post.thumbnail_url,
                                                                                caption: post.caption,
                                                                                thumbnail_url: post.thumbnail_url || post.media_url
                                                                            });
                                                                            setShowPostSelector(false);
                                                                        }}
                                                                    >
                                                                        {(post.media_type === 'IMAGE' || post.media_type === 'CAROUSEL_ALBUM') && (
                                                                            <img src={post.media_url} className="w-full h-full object-cover" />
                                                                        )}
                                                                        {post.media_type === 'VIDEO' && (
                                                                            <img src={post.thumbnail_url} className="w-full h-full object-cover" />
                                                                        )}
                                                                    </div>
                                                                ))}
                                                                {availablePosts.length === 0 && (
                                                                    <p className="col-span-3 text-center py-4 text-sm">Nenhum post recente encontrado.</p>
                                                                )}
                                                            </div>
                                                        )}
                                                        <div className="mt-2 text-xs text-muted-foreground text-center">
                                                            Mostrando os 24 posts mais recentes.
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Fallback Manual Input */}
                                                {!selectedPost && !showPostSelector && (
                                                    <div className="pt-2">
                                                        <p className="text-xs text-muted-foreground mb-1">Ou insira o ID manualmente:</p>
                                                        <Input
                                                            placeholder="Media ID (Opcional)"
                                                            className="h-8 text-xs"
                                                            onChange={(e) => {
                                                                if (e.target.value.length > 5) {
                                                                    setSelectedPost({ id: e.target.value, url: '', caption: 'Manual Input' })
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Button variant="ghost" onClick={() => router.back()}>Cancelar</Button>
                    <Button onClick={handleCreate} disabled={loading}>
                        {loading ? 'Criando...' : 'Criar Automação'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
