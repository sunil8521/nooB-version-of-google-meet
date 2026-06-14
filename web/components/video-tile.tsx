"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { MicOff } from "lucide-react";

interface VideoTileProps {
    name: string;
    initials: string;
    isMuted: boolean;
    isVideoOff: boolean;
    stream: MediaStream | null;
    isLocal: boolean;
}

export function VideoTile({
    name,
    initials,
    isMuted,
    isVideoOff,
    stream,
    isLocal,
}: VideoTileProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const showVideo = stream && !isVideoOff && stream.getVideoTracks().length > 0;

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
        }
    }, [stream]);

    return (
        <div className="relative w-full h-full min-h-0 rounded-md md:rounded-lg overflow-hidden bg-video-bg">
            {/* Video element — always mounted */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isLocal}
                className={cn(
                    "absolute inset-0 w-full h-full object-cover",
                    isLocal && "scale-x-[-1]",
                    !showVideo && "hidden"
                )}
            />

            {/* Avatar fallback */}
            {!showVideo && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 md:w-20 md:h-20 rounded-full bg-primary/80 flex items-center justify-center">
                        <span className="text-base md:text-2xl font-semibold text-white">
                            {initials}
                        </span>
                    </div>
                </div>
            )}

            {/* Name tag */}
            <div className="absolute bottom-1 left-1 md:bottom-2 md:left-2 flex items-center gap-1 md:gap-1.5 bg-black/60 backdrop-blur-sm rounded-md px-1.5 md:px-2 py-0.5">
                <span className="text-white text-[10px] md:text-xs font-medium truncate max-w-[80px] md:max-w-[120px]">
                    {isLocal ? `${name} (YOU)` : name}
                </span>
                {isMuted && (
                    <MicOff className="w-3 h-3 md:w-3.5 md:h-3.5 flex-shrink-0" color="#ee5858ff" />
                )}
            </div>
        </div>
    );
}