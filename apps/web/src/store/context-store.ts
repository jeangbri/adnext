import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppState {
    selectedProjectId: string | null
    selectedPageId: string | 'ALL' | null
    setProject: (id: string | null) => void
    setPage: (id: string | 'ALL' | null) => void
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            selectedProjectId: null,
            selectedPageId: null,
            setProject: (id) => set({ selectedProjectId: id, selectedPageId: id ? 'ALL' : null }),
            setPage: (id) => set({ selectedPageId: id })
        }),
        {
            name: 'adnext-context'
        }
    )
)
