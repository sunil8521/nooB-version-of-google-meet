"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useMeetingStore } from "@/store/use-meeting-store";
import { VideoTile } from "@/components/video-tile";
import { MeetingToolbar } from "@/components/meeting-toolbar";
import { ChatPanel } from "@/components/chat-panel";
import { getSocket } from "@/lib/socket";
import { toast } from "sonner";
import { Copy } from "lucide-react";

const MAX_FIT = 12;
const GAP = 4;

/** Responsive column count — fewer on mobile */
function getGridCols(count: number, isMobile: boolean): number {
    if (isMobile) {
        if (count <= 2) return 1; // Stack 1 or 2 participants vertically
        return 2; // max 2 cols on mobile for 3+ participants
    }
    if (count <= 1) return 1;
    if (count <= 4) return 2;
    if (count <= 9) return 3;
    return 4;
}

export default function MeetingPage() {
    const router = useRouter();
    const params = useParams();
    const meetingId = params.id as string;

    const {
        isMuted, isVideoOff, localStream, hasJoined,
        participants, messages, isChatOpen, isScreenSharing, roomId,
        setIsMuted, setIsVideoOff, joinMeeting, leaveMeeting,
        toggleChat, toggleScreenShare, sendMessage, sendFile,
    } = useMeetingStore();

    const gridRef = useRef<HTMLDivElement>(null);
    const [lockedTileHeight, setLockedTileHeight] = useState<number>(0);
    const [isMobile, setIsMobile] = useState(false);

    // Detect mobile
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    const count = Object.keys(participants).length;
    const shouldScroll = count > MAX_FIT;
    const gridCols = getGridCols(count, isMobile);
    const gridRows = shouldScroll ? undefined : Math.ceil(count / gridCols);

    // Lock tile height at MAX_FIT participants
    useEffect(() => {
        if (count >= MAX_FIT && lockedTileHeight === 0 && gridRef.current) {
            const gridHeight = gridRef.current.clientHeight;
            const rows = isMobile ? 4 : 3;
            const tileH = Math.floor((gridHeight - GAP * (rows - 1)) / rows);
            setLockedTileHeight(tileH);
        }
    }, [count, lockedTileHeight, isMobile]);

    // Sync self participant's media state
    useEffect(() => {
        const { selfId, participants } = useMeetingStore.getState();
        if (!selfId || !participants[selfId]) return;
        useMeetingStore.setState((s) => ({
            participants: {
                ...s.participants,
                [selfId]: {
                    ...s.participants[selfId],
                    isMuted,
                    isVideoOff,
                    stream: localStream,
                },
            },
        }));
    }, [isMuted, isVideoOff, localStream]);

    const handleLeave = () => {
        leaveMeeting();
        router.push("/");
    };

    const toggleAudio = () => {
        if (!localStream || localStream.getAudioTracks().length === 0) {
            toast.error("Microphone not available", { description: "Please allow microphone access in your browser settings" });
            return;
        }
        const next = !isMuted;
        localStream.getAudioTracks().forEach(track => { track.enabled = !next; });
        setIsMuted(next);
        const socket = getSocket();
        if (socket.connected) socket.emit("toggle-audio", { roomId, isMuted: next });
    };

    const toggleVideo = () => {
        if (!localStream || localStream.getVideoTracks().length === 0) {
            toast.error("Camera not available", { description: "Please allow camera access in your browser settings" });
            return;
        }
        const next = !isVideoOff;
        localStream.getVideoTracks().forEach(track => { track.enabled = !next; });
        setIsVideoOff(next);
        const socket = getSocket();
        if (socket.connected) socket.emit("toggle-video", { roomId, isVideoOff: next });
    };

    return (
        <div className="h-[100dvh] flex flex-col bg-meeting-bg overflow-hidden">
            <div className="flex-1 flex overflow-hidden min-h-0 relative">
                <div className="flex-1 flex flex-col min-w-0 min-h-0">
                    {/* Video grid */}
                    <div
                        ref={gridRef}
                        className="flex-1 p-1 md:p-2 min-h-0"
                        style={{
                            display: "grid",
                            gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                            ...(shouldScroll
                                ? {
                                    gridAutoRows: `${lockedTileHeight || (isMobile ? 150 : 200)}px`,
                                    overflowY: "auto",
                                }
                                : {
                                    gridTemplateRows: `repeat(${gridRows}, 1fr)`,
                                    overflow: "hidden",
                                }),
                            gap: `${GAP}px`,
                        }}
                    >
                        {Object.values(participants).map((p) => (
                            <VideoTile
                                key={p.id}
                                name={p.name}
                                initials={p.initials}
                                isMuted={p.isMuted}
                                isVideoOff={p.isVideoOff}
                                stream={p.stream}
                                isLocal={p.isLocal}
                            />
                        ))}
                    </div>

                    {/* Footer Controls */}
                    <div className="absolute bottom-4 left-0 right-0 px-4 pointer-events-none">
                        <div className="max-w-7xl mx-auto flex items-end justify-center relative h-[52px]">
                            
                            {/* Center Toolbar */}
                            <div className="pointer-events-auto">
                                <MeetingToolbar
                                    audioEnabled={!isMuted}
                                    videoEnabled={!isVideoOff}
                                    isScreenSharing={isScreenSharing}
                                    isChatOpen={isChatOpen}
                                    participantCount={count}
                                    onToggleAudio={toggleAudio}
                                    onToggleVideo={toggleVideo}
                                    onToggleScreenShare={toggleScreenShare}
                                    onToggleChat={toggleChat}
                                    onLeave={handleLeave}
                                />
                            </div>

                        </div>
                    </div>
                    
                    {/* Top Right Floating Share Button */}
                    <div className="absolute top-4 right-4 z-10">
                        <button
                            onClick={() => {
                                const url = `${window.location.origin}/lobby/${meetingId}`;
                                navigator.clipboard.writeText(url);
                                toast.success("Join link copied to clipboard!");
                            }}
                            className="flex items-center gap-1.5 md:gap-2 bg-[#2d2e31] hover:bg-[#3d3e41] text-white px-3 md:px-4 py-2 md:py-2.5 rounded-full shadow-lg transition-colors font-medium text-xs md:text-sm border border-white/10"
                            title="Copy join link"
                        >
                            <Copy className="w-3.5 h-3.5 md:w-[18px] md:h-[18px]" />
                            <span>Share Link</span>
                        </button>
                    </div>
                </div>

                {/* Chat panel — full overlay on mobile, sidebar on desktop */}
                <ChatPanel
                    messages={messages}
                    onSendMessage={sendMessage}
                    onSendFile={sendFile}
                    isOpen={isChatOpen}
                    onClose={toggleChat}
                />
            </div>
        </div>
    );
}
