"use client";

import { Mic, MicOff, Video, VideoOff, MonitorUp, MessageSquare, PhoneOff, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface MeetingToolbarProps {
    audioEnabled: boolean;
    videoEnabled: boolean;
    isScreenSharing: boolean;
    isChatOpen: boolean;
    participantCount: number;
    onToggleAudio: () => void;
    onToggleVideo: () => void;
    onToggleScreenShare: () => void;
    onToggleChat: () => void;
    onLeave: () => void;
}

export function MeetingToolbar({
    audioEnabled, videoEnabled, isScreenSharing, isChatOpen,
    participantCount,
    onToggleAudio, onToggleVideo, onToggleScreenShare, onToggleChat, onLeave,
}: MeetingToolbarProps) {
    return (
        <div className="flex items-center justify-center py-3">
            <div className="flex items-center gap-1.5 bg-[#2d2e31] rounded-full px-3 py-1.5 shadow-xl">
                {/* Mic */}
                <button
                    onClick={onToggleAudio}
                    className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer",
                        !audioEnabled ? "bg-destructive text-white" : "text-white hover:bg-white/10"
                    )}
                    title={audioEnabled ? "Mute microphone" : "Unmute microphone"}
                >
                    {audioEnabled ? <Mic className="w-[18px] h-[18px]" /> : <MicOff className="w-[18px] h-[18px]" />}
                </button>

                {/* Camera */}
                <button
                    onClick={onToggleVideo}
                    className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer",
                        !videoEnabled ? "bg-destructive text-white" : "text-white hover:bg-white/10"
                    )}
                    title={videoEnabled ? "Turn off camera" : "Turn on camera"}
                >
                    {videoEnabled ? <Video className="w-[18px] h-[18px]" /> : <VideoOff className="w-[18px] h-[18px]" />}
                </button>

                {/* Screen share */}
                <button
                    onClick={onToggleScreenShare}
                    className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer",
                        isScreenSharing ? "bg-primary text-white" : "text-white hover:bg-white/10"
                    )}
                    title="Share screen"
                >
                    <MonitorUp className="w-[18px] h-[18px]" />
                </button>

                {/* Divider */}
                <div className="w-px h-6 bg-white/20 mx-0.5" />

                {/* Participants */}
                <button
                    className="h-10 rounded-full flex items-center justify-center gap-1 px-2.5 text-white hover:bg-white/10 transition-colors cursor-pointer"
                    title="Participants"
                >
                    <Users className="w-[18px] h-[18px]" />
                    <span className="text-xs font-medium">{participantCount}</span>
                </button>

                {/* Chat */}
                <button
                    onClick={onToggleChat}
                    className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer",
                        isChatOpen ? "bg-primary text-white" : "text-white hover:bg-white/10"
                    )}
                    title="Chat"
                >
                    <MessageSquare className="w-[18px] h-[18px]" />
                </button>

                {/* Divider */}
                <div className="w-px h-6 bg-white/20 mx-0.5" />

                {/* Leave */}
                <button
                    onClick={onLeave}
                    className="h-10 px-4 rounded-full bg-destructive text-white hover:bg-destructive/90 flex items-center justify-center transition-colors cursor-pointer"
                    title="Leave meeting"
                >
                    <PhoneOff className="w-[18px] h-[18px]" />
                </button>
            </div>
        </div>
    );
}
