"use client";

import { useMicVolume } from "@/hooks/use-mic-volume";
import { cn } from "@/lib/utils";

interface MicVisualizerProps {
    stream: MediaStream | null;
    isMuted: boolean;
    className?: string;
}

export function MicVisualizer({ stream, isMuted, className }: MicVisualizerProps) {
    const volume = useMicVolume(stream, !isMuted);

    // If muted, show a static state (e.g., small flat lines)
    // If not muted, animate 3 bars based on the volume percentage.

    const height1 = isMuted ? 10 : Math.max(10, volume * 0.8);
    const height2 = isMuted ? 10 : Math.max(10, volume * 1.2);
    const height3 = isMuted ? 10 : Math.max(10, volume * 0.9);

    return (
        <div className={cn("flex items-center justify-center gap-[2px] h-4 w-4", className)}>
            <div 
                className="w-1 bg-blue-500 rounded-full transition-all duration-75"
                style={{ height: `${height1}%` }}
            />
            <div 
                className="w-1 bg-blue-500 rounded-full transition-all duration-75"
                style={{ height: `${height2}%` }}
            />
            <div 
                className="w-1 bg-blue-500 rounded-full transition-all duration-75"
                style={{ height: `${height3}%` }}
            />
        </div>
    );
}
