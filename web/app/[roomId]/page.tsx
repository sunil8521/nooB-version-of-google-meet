"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMeetingStore } from "@/store/use-meeting-store";

// Components
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import VideoPreview from "@/components/Video-preview";
import { VideoTile } from "@/components/video-tile";
import { MeetingToolbar } from "@/components/meeting-toolbar";
import { ChatPanel } from "@/components/chat-panel";
import { getSocket } from "@/lib/socket";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";

/* ── Lobby View ── */
function LobbyView({ roomId, onJoin }: { roomId: string, onJoin: (name: string) => void }) {
    const nameRef = useRef<HTMLInputElement | null>(null);

    const handleJoin = () => {
        const name = nameRef.current?.value;
        if (name && name.trim()) {
            onJoin(name.trim());
        } else {
            toast.error("Please enter your name");
        }
    };

    return (
        <div className="min-h-screen bg-muted flex flex-col">
            <Header />
            <div className="flex-1 flex items-center justify-center p-6 md:p-12">
                <div className="w-full max-w-5xl grid md:grid-cols-5 gap-8 items-center animate-fade-in">
                    <VideoPreview />
                    <div className="md:col-span-2">
                        <div className="bg-white rounded-2xl p-8 shadow-lg border border-border space-y-6 animate-slide-up">
                            <div className="space-y-2 text-center">
                                <h1 className="text-2xl font-display font-medium text-foreground">Ready to join?</h1>
                                <p className="text-sm text-muted-foreground">
                                    Meeting code: <span className="font-mono text-foreground font-medium">{roomId}</span>
                                </p>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label htmlFor="name" className="text-sm font-medium text-foreground">Your name</label>
                                    <Input
                                        id="name"
                                        ref={nameRef}
                                        onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                                        placeholder="Enter your name"
                                        className="h-12 text-base"
                                        autoFocus
                                    />
                                </div>
                                <Button
                                    size="lg"
                                    onClick={handleJoin}
                                    className="w-full h-12 text-base font-medium bg-primary hover:bg-primary/90"
                                >
                                    Join now
                                </Button>
                            </div>
                            <div className="pt-4 border-t border-border">
                                <p className="text-xs text-muted-foreground text-center">
                                    By joining, you agree to our terms of service and privacy policy.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Active Meeting View ── */
const MAX_FIT = 12;
const GAP = 4;

function getGridCols(count: number, isMobile: boolean): number {
    if (isMobile) {
        if (count <= 2) return 1;
        return 2;
    }
    if (count <= 1) return 1;
    if (count <= 4) return 2;
    if (count <= 9) return 3;
    return 4;
}

function ActiveMeetingView({ roomId, onLeave }: { roomId: string, onLeave: () => void }) {
    const {
        isMuted, isVideoOff, localStream,
        participants, messages, isChatOpen, isScreenSharing,
        setIsMuted, setIsVideoOff, leaveMeeting,
        toggleChat, toggleScreenShare, sendMessage, sendFile,
    } = useMeetingStore();

    const gridRef = useRef<HTMLDivElement>(null);
    const [lockedTileHeight, setLockedTileHeight] = useState<number>(0);
    const [isMobile, setIsMobile] = useState(false);

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

    useEffect(() => {
        if (count >= MAX_FIT && lockedTileHeight === 0 && gridRef.current) {
            const gridHeight = gridRef.current.clientHeight;
            const rows = isMobile ? 4 : 3;
            const tileH = Math.floor((gridHeight - GAP * (rows - 1)) / rows);
            setLockedTileHeight(tileH);
        }
    }, [count, lockedTileHeight, isMobile]);

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
        onLeave();
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

                    <div className="absolute bottom-4 left-0 right-0 px-4 pointer-events-none">
                        <div className="max-w-7xl mx-auto flex items-end justify-center relative h-[52px]">
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

                    <div className="absolute top-4 right-4 z-10">
                        <button
                            onClick={() => {
                                const url = `${window.location.origin}/${roomId}`;
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

/* ── Main Unified Page ── */
export default function UnifiedMeetingPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const roomId = params.roomId as string;
    const isCreating = searchParams.get("create") === "true";

    const [roomState, setRoomState] = useState<'LOBBY' | 'JOINING' | 'CONNECTED'>('LOBBY');
    const [mounted, setMounted] = useState(false);
    const [roomExists, setRoomExists] = useState<boolean | null>(null);

    const { setRoomId, setUserName, joinMeeting, hasJoined } = useMeetingStore();

    // Prevent SSR media API crashes and check room existence
    useEffect(() => {
        setMounted(true);
        setRoomId(roomId);

        if (isCreating) {
            setRoomExists(true);
            return;
        }

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL!;
        fetch(`${socketUrl}/api/room/${roomId}`)
            .then(res => res.json())
            .then(data => {
                setRoomExists(data.exists);
            })
            .catch(() => {
                setRoomExists(false);
            });
    }, [roomId, setRoomId, isCreating]);

    // Transition to CONNECTED once joined
    useEffect(() => {
        if (roomState === 'JOINING' && hasJoined) {
            setRoomState('CONNECTED');
        }
    }, [roomState, hasJoined]);

    if (!mounted || roomExists === null) return null; // Avoid hydration mismatch and media errors on server

    if (roomExists === false) {
        return (
            <div className="min-h-screen bg-muted flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-lg border border-border max-w-md w-full text-center space-y-6">
                    <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-destructive text-2xl font-bold">!</span>
                    </div>
                    <h1 className="text-2xl font-display font-medium text-foreground">Room Not Found</h1>
                    <p className="text-muted-foreground">
                        The meeting code <strong>{roomId}</strong> does not exist or the meeting has ended.
                    </p>
                    <Button
                        size="lg"
                        onClick={() => router.push("/")}
                        className="w-full bg-primary hover:bg-primary/90"
                    >
                        Return Home
                    </Button>
                </div>
            </div>
        );
    }

    if (roomState === 'LOBBY') {
        return (
            <LobbyView
                roomId={roomId}
                onJoin={(name) => {
                    setUserName(name);
                    setRoomState('JOINING');
                    joinMeeting();
                }}
            />
        );
    }

    if (roomState === 'JOINING') {
        return (
            <div className="min-h-screen bg-muted flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground text-lg font-medium animate-pulse">
                    Joining meeting...
                </p>
            </div>
        );
    }

    return <ActiveMeetingView roomId={roomId} onLeave={() => router.push("/")} />;
}
