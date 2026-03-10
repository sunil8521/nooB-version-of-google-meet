"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useMeetingStore } from "@/store/use-meeting-store";
import { VideoTile } from "@/components/video-tile";
import { MeetingToolbar } from "@/components/meeting-toolbar";
import { ChatPanel } from "@/components/chat-panel";
import { getSocket } from "@/lib/socket";
import { toast } from "sonner";
const MAX_FIT = 12;
const GAP = 6;

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

    const count = Object.keys(participants).length;
    const shouldScroll = count > MAX_FIT;
    const gridCols = count <= 1 ? 1 : count <= 4 ? 2 : count <= 9 ? 3 : 4;
    const gridRows = shouldScroll ? undefined : Math.ceil(count / gridCols);

    // Lock tile height at 12 participants
    useEffect(() => {
        if (count >= MAX_FIT && lockedTileHeight === 0 && gridRef.current) {
            const gridHeight = gridRef.current.clientHeight;
            const rows = 3;
            const tileH = Math.floor((gridHeight - GAP * (rows - 1)) / rows);
            setLockedTileHeight(tileH);
        }
    }, [count, lockedTileHeight]);

    
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
        const next = !isMuted

        localStream.getAudioTracks().forEach(track => {
            track.enabled = !next
        })

        setIsMuted(next);


        const socket = getSocket();
        if (socket.connected) {
            socket.emit("toggle-audio", { roomId, isMuted: next });
        }
    };

    const toggleVideo = () => {
          if (!localStream || localStream.getVideoTracks().length === 0) {
            toast.error("Camera not available", { description: "Please allow camera access in your browser settings" });
            return;
        }
        const next = !isVideoOff
        localStream.getVideoTracks().forEach(track => {
            track.enabled = !next
        })

        setIsVideoOff(next);
        const socket = getSocket();
        if (socket.connected) {
            socket.emit("toggle-video", { roomId, isVideoOff: next });
        }
    };

    

    return (
        <div className="h-screen flex flex-col bg-meeting-bg overflow-hidden">
            <div className="flex-1 flex overflow-hidden min-h-0">
                <div className="flex-1 flex flex-col min-w-0 min-h-0">
                    {/* Video grid */}
                    <div
                        ref={gridRef}
                        className="flex-1 p-2 min-h-0"
                        style={{
                            display: "grid",
                            gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                            ...(shouldScroll
                                ? {
                                    gridAutoRows: `${lockedTileHeight || 200}px`,
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
