"use client"

import { useEffect, useState } from 'react'

export function AuthBackground() {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) return null

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Deep Space Background with subtle gradient */}
            <div className="absolute inset-0 bg-[#020617] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.1),rgba(255,255,255,0))]" />

            {/* Intense Blue Lights - Top Center/Left */}
            <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-blue-500/20 blur-[120px] mix-blend-screen animate-pulse-slow" />

            {/* Cyan/Teal Accents - Bottom Right */}
            <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-cyan-500/20 blur-[100px] mix-blend-screen animate-pulse-slow delay-700" />

            {/* Center subtle glow behind form */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50%] h-[50%] rounded-full bg-blue-400/10 blur-[90px]" />

            {/* Floating Particles */}
            <div className="absolute inset-0">
                {Array.from({ length: 20 }).map((_, i) => (
                    <div
                        key={i}
                        className="absolute rounded-full bg-white animate-float"
                        style={{
                            top: `${Math.random() * 100}%`,
                            left: `${Math.random() * 100}%`,
                            width: `${Math.random() * 3 + 1}px`, // 1-4px size
                            height: `${Math.random() * 3 + 1}px`,
                            opacity: Math.random() * 0.4 + 0.1, // 0.1-0.5 opacity
                            animationDuration: `${Math.random() * 10 + 10}s`, // 10-20s duration
                            animationDelay: `${Math.random() * 5}s`,
                        }}
                    />
                ))}
            </div>

            {/* Grid overlay for texture */}
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.02]" />
        </div>
    )
}
