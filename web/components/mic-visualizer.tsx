"use client";

import { useMicVolume } from "@/hooks/use-mic-volume";
import { cn } from "@/lib/utils";

interface MicVisualizerProps {
    stream: MediaStream | null;
    isMuted: boolean;
    className?: string;
    variant?: "dark-bg" | "light-bg";
}

export function MicVisualizer({ stream, isMuted, className, variant = "dark-bg" }: MicVisualizerProps) {
    const volume = useMicVolume(stream, !isMuted);

    // If muted, show a static state (e.g., small flat lines)
    // If not muted, animate 3 bars based on the volume percentage.

    const height1 = isMuted ? 4 : Math.max(4, Math.min(12, volume * 0.12));
    const height2 = isMuted ? 4 : Math.max(4, Math.min(16, volume * 0.18));
    const height3 = isMuted ? 4 : Math.max(4, Math.min(12, volume * 0.14));

    const containerColor = variant === "light-bg" ? "bg-black/5" : "bg-white/20";
    
    // Always use the requested Google Blue color for the bars
    const barColor = "bg-[#1A73E8]";

    return (
        <div className={cn("flex items-center justify-center gap-[2px] w-6 h-6 md:w-7 md:h-7 rounded-full backdrop-blur-sm", containerColor, className)}>
            <div 
                className={cn("w-[3px] md:w-1 rounded-full transition-all duration-75", barColor)}
                style={{ height: `${height1}px` }}
            />
            <div 
                className={cn("w-[3px] md:w-1 rounded-full transition-all duration-75", barColor)}
                style={{ height: `${height2}px` }}
            />
            <div 
                className={cn("w-[3px] md:w-1 rounded-full transition-all duration-75", barColor)}
                style={{ height: `${height3}px` }}
            />
        </div>
    );
}
