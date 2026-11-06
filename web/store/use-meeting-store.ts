import { create } from "zustand";
import { getSocket, disconnectSocket } from "@/lib/socket";
import type { Socket } from "socket.io-client";
import { webRTCManager } from "@/lib/webrtc-manager";
import { toast } from "sonner";

export interface Participant {
    id: string;
    name: string;
    initials: string;
    isMuted: boolean;
    isVideoOff: boolean;
    stream: MediaStream | null;
    isLocal: boolean;
}

export interface FileAttachment {
    fileName: string;
    fileSize: number;
    fileType: string;
    fileUrl: string;
}

export interface ChatMessage {
    id: string;
    sender: string;
    initials: string;
    text: string;
    timestamp: Date;
    attachment?: FileAttachment;
}

interface MeetingState {
    userName: string;
    roomId: string;
    isMuted: boolean;
    isVideoOff: boolean;
    localStream: MediaStream | null;

    participants: Record<string, Participant>;
    selfId: string | null;
    messages: ChatMessage[];
    isChatOpen: boolean;
    isScreenSharing: boolean;
    hasJoined: boolean;
    isConnected: boolean;

    setUserName: (name: string) => void;
    setRoomId: (id: string) => void;
    setIsMuted: (v: boolean) => void;
    setIsVideoOff: (v: boolean) => void;
    setLocalStream: (s: MediaStream | null) => void;

    joinMeeting: () => void;
    leaveMeeting: () => void;
    toggleChat: () => void;
    toggleScreenShare: () => void;
    sendMessage: (text: string) => void;
    sendFile: (file: File) => void;
    setupSocketListeners: (socket: Socket) => void;
    cleanupSocketListeners: () => void;
}

const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};


export const useMeetingStore = create<MeetingState>((set, get) => ({
    userName: "",
    selfId: null,
    roomId: "",
    isMuted: false,
    isVideoOff: false,
    localStream: null,
    participants: {},
    messages: [],
    isChatOpen: false,
    isScreenSharing: false,
    hasJoined: false,
    isConnected: false,

    setUserName: (name) => set({ userName: name }),
    setRoomId: (id) => set({ roomId: id }),
    setIsMuted: (v) => set({ isMuted: v }),
    setIsVideoOff: (v) => set({ isVideoOff: v }),
    setLocalStream: (s) => set({ localStream: s }),

    joinMeeting: () => {
        const { userName, isMuted, isVideoOff, localStream, roomId } = get();
        const socket = getSocket();
        if (!socket.connected) socket.connect();

        socket.once("connect", () => {
            const id = socket.id!;
            const self: Participant = {
                id,
                name: userName,
                initials: getInitials(userName),
                isMuted,
                isVideoOff,
                stream: localStream,
                isLocal: true,
            };
            set({
                hasJoined: true,
                selfId: id,
                participants: { [id]: self },
            });
            socket.emit("join-room", { roomId, userName, isMuted, isVideoOff });
        });
    },

    leaveMeeting: () => {
        const { localStream, roomId } = get();
        const socket = getSocket();
        socket.emit("leave-room", { roomId });
        get().cleanupSocketListeners();
        webRTCManager.closeAllPeerConnections();
        disconnectSocket();
        localStream?.getTracks().forEach((t) => t.stop());
        set({
            hasJoined: false,
            selfId: null,
            participants: {},
            messages: [],
            isChatOpen: false,
            isScreenSharing: false,
            localStream: null,
            isConnected: false,
        });
    },

    toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen })),

    toggleScreenShare: async () => {
        await webRTCManager.toggleScreenShare();
    },

    sendMessage: (text) => {
        const { userName, roomId } = get();
        const socket = getSocket();
        socket.emit("send-message", {
            roomId,
            text,
            sender: userName || "You",
            initials: getInitials(userName || "You"),
        });
    },

    sendFile: (file: File) => {
        webRTCManager.sendFile(file);
    },

    setupSocketListeners: (socket) => {
        webRTCManager.setupSocketListeners(socket);
    },

    cleanupSocketListeners: () => {
        webRTCManager.cleanupSocketListeners();
    },
}));
