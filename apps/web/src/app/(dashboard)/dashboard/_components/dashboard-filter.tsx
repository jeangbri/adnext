"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Facebook } from "lucide-react"

export function DashboardFilter() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [accounts, setAccounts] = useState<any[]>([])
    const [selectedPage, setSelectedPage] = useState<string>(searchParams.get('pageId') || 'all')

    useEffect(() => {
        const fetchPages = async () => {
            try {
                const res = await fetch('/api/messenger/status')
                if (res.ok) {
                    const data = await res.json()
                    setAccounts(data.accounts || [])
                }
            } catch (e) {
                console.error(e)
            }
        }
        fetchPages()
    }, [])

    const handleValueChange = (val: string) => {
        setSelectedPage(val)
        const params = new URLSearchParams(searchParams.toString())
        if (val === 'all') {
            params.delete('pageId')
        } else {
            params.set('pageId', val)
        }
        router.push(`/dashboard?${params.toString()}`)
    }

    if (accounts.length === 0) return null

    return (
        <div className="flex items-center gap-2">
            <Select value={selectedPage} onValueChange={handleValueChange}>
                <SelectTrigger className="w-[200px] bg-zinc-900 border-zinc-700 text-zinc-200">
                    <div className="flex items-center gap-2">
                        <Facebook className="w-4 h-4 text-blue-500" />
                        <SelectValue placeholder="Todas as páginas" />
                    </div>
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                    <SelectItem value="all">Todas as Páginas</SelectItem>
                    {accounts.map(account => (
                        <SelectItem key={account.id} value={account.pageId}>
                            {account.pageName}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
