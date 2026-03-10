import { create } from "zustand";
import { getSocket, disconnectSocket } from "@/lib/socket";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";

/* ── Types ── */
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
    /* User */
    userName: string;
    roomId: string;
    isMuted: boolean;
    isVideoOff: boolean;
    localStream: MediaStream | null;

    /* Meeting */
    participants: Record<string, Participant>;
    selfId: string | null;
    messages: ChatMessage[];
    isChatOpen: boolean;
    isScreenSharing: boolean;
    hasJoined: boolean;
    isConnected: boolean;

    /* Actions — lobby */
    setUserName: (name: string) => void;
    setRoomId: (id: string) => void;
    setIsMuted: (v: boolean) => void;
    setIsVideoOff: (v: boolean) => void;
    setLocalStream: (s: MediaStream | null) => void;

    /* Actions — meeting */
    joinMeeting: () => void;
    leaveMeeting: () => void;
    toggleChat: () => void;
    toggleScreenShare: () => void;
    sendMessage: (text: string) => void;
    sendFile: (file: File) => void;
    setupSocketListeners: (socket: Socket) => void;
    cleanupSocketListeners: () => void;
}

/* ── Helpers ── */
const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/* ── WebRTC ── */
const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
    ],
};

const CHUNK_SIZE = 16384; // 16KB chunks for file transfer

// Keep peer connections & data channels outside zustand (not serializable)
const peerConnections = new Map<string, RTCPeerConnection>();
const dataChannels = new Map<string, RTCDataChannel>();

// Per-peer file receive state
const fileReceiveState = new Map<string, {
    chunks: ArrayBuffer[];
    receivedSize: number;
    fileName: string;
    fileSize: number;
    fileType: string;
}>();

/** Handle an incoming data channel message (both sender & receiver use this) */
function handleDataChannelMessage(
    peerId: string,
    event: MessageEvent,
    set: (fn: (s: MeetingState) => Partial<MeetingState>) => void,
    get: () => MeetingState,
) {
    // String message = file metadata or chat message with attachment info
    if (typeof event.data === "string") {
        const parsed = JSON.parse(event.data);

        if (parsed.type === "file-meta") {
            // Store file metadata for incoming transfer
            fileReceiveState.set(peerId, {
                chunks: [],
                receivedSize: 0,
                fileName: parsed.fileName,
                fileSize: parsed.fileSize,
                fileType: parsed.fileType,
            });
            console.log(`📁 Receiving file "${parsed.fileName}" (${formatFileSize(parsed.fileSize)}) from ${peerId}`);
            return;
        }

        if (parsed.type === "file-complete") {
            // File transfer complete — build blob, create URL, add chat message
            const state = fileReceiveState.get(peerId);
            if (!state) return;

            const blob = new Blob(state.chunks, { type: state.fileType });
            const fileUrl = URL.createObjectURL(blob);

            toast.dismiss(`file-progress-${peerId}`);
            toast.success(`File received: ${state.fileName}`, { duration: 4000 });

            const msg: ChatMessage = {
                id: parsed.messageId,
                sender: parsed.sender,
                initials: parsed.initials,
                text: `📎 ${state.fileName}`,
                timestamp: new Date(parsed.timestamp),
                attachment: {
                    fileName: state.fileName,
                    fileSize: state.fileSize,
                    fileType: state.fileType,
                    fileUrl,
                },
            };

            set((s) => {
                if (s.messages.find((m) => m.id === msg.id)) return s;
                return { messages: [...s.messages, msg] };
            });

            fileReceiveState.delete(peerId);
            return;
        }
        return;
    }

    // Binary message = file chunk
    const state = fileReceiveState.get(peerId);
    if (!state) return;

    let buf: ArrayBuffer;
    if (event.data instanceof ArrayBuffer) {
        buf = event.data;
    } else {
        return;
    }

    state.chunks.push(buf);
    state.receivedSize += buf.byteLength;

    const progress = Math.floor((state.receivedSize / state.fileSize) * 100);
    toast.loading(`Receiving "${state.fileName}": ${progress}%`, {
        id: `file-progress-${peerId}`,
        duration: Infinity,
    });
}

/** Setup data channel event handlers */
function setupDataChannel(
    channel: RTCDataChannel,
    peerId: string,
    set: (fn: (s: MeetingState) => Partial<MeetingState>) => void,
    get: () => MeetingState,
) {
    channel.binaryType = "arraybuffer";

    channel.onopen = () => {
        console.log(`📡 Data channel open with ${peerId}`);
        dataChannels.set(peerId, channel);
    };

    channel.onclose = () => {
        console.log(`📡 Data channel closed with ${peerId}`);
        dataChannels.delete(peerId);
        // Clean up any in-progress transfers
        if (fileReceiveState.has(peerId)) {
            toast.dismiss(`file-progress-${peerId}`);
            fileReceiveState.delete(peerId);
        }
    };

    channel.onmessage = (event) => {
        handleDataChannelMessage(peerId, event, set, get);
    };
}

/* Create a peer connection for a remote peer */
function createPeerConnection(
    peerId: string,
    socket: Socket,
    localStream: MediaStream | null,
    set: (fn: (s: MeetingState) => Partial<MeetingState>) => void,
    get: () => MeetingState,
    isOfferer: boolean,
): RTCPeerConnection {
    // Clean up existing connection
    if (peerConnections.has(peerId)) {
        peerConnections.get(peerId)!.close();
        dataChannels.delete(peerId);
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.set(peerId, pc);

    // Add local tracks
    if (localStream) {
        localStream.getTracks().forEach((track) => {
            pc.addTrack(track, localStream);
        });
    }

    // Ensure both audio and video transceivers exist
    const transceivers = pc.getTransceivers();
    const hasAudio = transceivers.some(t => t.receiver.track.kind === "audio");
    const hasVideo = transceivers.some(t => t.receiver.track.kind === "video");
    if (!hasAudio) pc.addTransceiver("audio", { direction: "recvonly" });
    if (!hasVideo) pc.addTransceiver("video", { direction: "recvonly" });

    // ── Data Channel ──
    if (isOfferer) {
        // Offerer creates the data channel
        const channel = pc.createDataChannel("file-transfer", { ordered: true });
        setupDataChannel(channel, peerId, set, get);
    } else {
        // Answerer waits for the incoming data channel
        pc.ondatachannel = (event) => {
            setupDataChannel(event.channel, peerId, set, get);
        };
    }

    // ICE candidates
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("ice-candidate", { to: peerId, candidate: event.candidate });
        }
    };

    // Remote tracks
    pc.ontrack = (event) => {
        const track = event.track;
        console.log(`🎥 Received ${track.kind} track from ${peerId}`);

        set((s) => {
            const user = s.participants[peerId];
            if (!user) return s;

            const existingTracks = user.stream ? user.stream.getTracks() : [];
            if (existingTracks.find((t) => t.id === track.id)) return s;

            const newStream = new MediaStream([...existingTracks, track]);
            console.log(`🎥 Stream for ${peerId} now has ${newStream.getTracks().length} tracks:`,
                newStream.getTracks().map((t) => t.kind));

            return {
                participants: {
                    ...s.participants,
                    [peerId]: { ...user, stream: newStream },
                },
            };
        });
    };

    pc.onconnectionstatechange = () => {
        console.log(`🔗 Peer ${peerId} connection: ${pc.connectionState}`);
    };

    return pc;
}

/** Create an offer and send it to a remote peer */
async function createAndSendOffer(
    peerId: string,
    socket: Socket,
    localStream: MediaStream | null,
    set: (fn: (s: MeetingState) => Partial<MeetingState>) => void,
    get: () => MeetingState,
) {
    const pc = createPeerConnection(peerId, socket, localStream, set, get, true);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", { to: peerId, offer });
    console.log(`📤 Sent offer to ${peerId}`);
}

/** Close a peer connection */
function closePeerConnection(peerId: string) {
    const pc = peerConnections.get(peerId);
    if (pc) {
        pc.close();
        peerConnections.delete(peerId);
        dataChannels.delete(peerId);
        fileReceiveState.delete(peerId);
    }
}

/** Close all peer connections */
function closeAllPeerConnections() {
    peerConnections.forEach((pc) => pc.close());
    peerConnections.clear();
    dataChannels.clear();
    fileReceiveState.clear();
}

/* ── Store ── */
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

    /* lobby setters */
    setUserName: (name) => set({ userName: name }),
    setRoomId: (id) => set({ roomId: id }),
    setIsMuted: (v) => set({ isMuted: v }),
    setIsVideoOff: (v) => set({ isVideoOff: v }),
    setLocalStream: (s) => set({ localStream: s }),

    /* Join meeting */
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

    /* Leave meeting */
    leaveMeeting: () => {
        const { localStream, roomId } = get();
        const socket = getSocket();
        socket.emit("leave-room", { roomId });
        get().cleanupSocketListeners();
        closeAllPeerConnections();
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
    toggleScreenShare: () => set((s) => ({ isScreenSharing: !s.isScreenSharing })),

    /* Send chat message via socket */
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

    /* Send file via DataChannel to all peers */
    sendFile: (file: File) => {
        const { userName, selfId } = get();
        const initials = getInitials(userName || "You");
        const messageId = `file-${Date.now()}-${selfId}`;

        if (dataChannels.size === 0) {
            toast.error("No peers connected", { description: "Wait for someone to join before sending files" });
            return;
        }

        // Send to each connected peer
        dataChannels.forEach((channel, peerId) => {
            if (channel.readyState !== "open") {
                console.warn(`📡 Channel to ${peerId} not open, skipping`);
                return;
            }

            // 1. Send file metadata
            channel.send(JSON.stringify({
                type: "file-meta",
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
            }));

            // 2. Send file in chunks
            const reader = new FileReader();
            let offset = 0;

            const readSlice = () => {
                const slice = file.slice(offset, offset + CHUNK_SIZE);
                reader.readAsArrayBuffer(slice);
            };

            reader.onload = (e) => {
                const buf = e.target?.result as ArrayBuffer;
                if (!buf) return;

                try {
                    channel.send(buf);
                } catch (err) {
                    console.error("Error sending chunk:", err);
                    toast.dismiss(`file-send-${peerId}`);
                    toast.error("File transfer failed");
                    return;
                }

                offset += buf.byteLength;
                const progress = Math.floor((offset / file.size) * 100);

                toast.loading(`Sending "${file.name}": ${progress}%`, {
                    id: `file-send-${peerId}`,
                    duration: Infinity,
                });

                if (offset < file.size) {
                    // Check bufferedAmount before sending more
                    if (channel.bufferedAmount > CHUNK_SIZE * 8) {
                        setTimeout(readSlice, 50);
                    } else {
                        readSlice();
                    }
                } else {
                    // 3. Send completion message
                    toast.dismiss(`file-send-${peerId}`);
                    toast.success(`File sent: ${file.name}`, { duration: 3000 });

                    channel.send(JSON.stringify({
                        type: "file-complete",
                        messageId,
                        sender: userName || "You",
                        initials,
                        timestamp: new Date().toISOString(),
                    }));
                }
            };

            readSlice();
        });

        // Add message to own chat immediately
        const fileUrl = URL.createObjectURL(file);
        const selfMsg: ChatMessage = {
            id: messageId,
            sender: userName || "You",
            initials,
            text: `📎 ${file.name}`,
            timestamp: new Date(),
            attachment: {
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                fileUrl,
            },
        };
        set((s) => ({ messages: [...s.messages, selfMsg] }));
    },

    /* Setup socket event listeners */
    setupSocketListeners: (socket) => {
        socket.on("connect", () => {
            set({ isConnected: true });
            console.log("🔌 Socket connected:", socket.id);
        });

        socket.on("disconnect", () => {
            set({ isConnected: false });
            console.log("🔌 Socket disconnected");
        });

        // ── Room Users ──
        socket.on("room-users", (users: Array<{
            socketId: string; name: string; initials: string; isMuted: boolean; isVideoOff: boolean;
        }>) => {
            const { localStream } = get();

            set((state) => {
                const updated = { ...state.participants };
                users.forEach((u) => {
                    updated[u.socketId] = {
                        id: u.socketId,
                        name: u.name,
                        initials: u.initials,
                        isMuted: u.isMuted,
                        isVideoOff: u.isVideoOff,
                        stream: null,
                        isLocal: false,
                    };
                });
                return { participants: updated };
            });

            // Create offers to all existing users (offerer = true → creates DataChannel)
            users.forEach((u) => {
                createAndSendOffer(u.socketId, socket, localStream, set, get);
            });
        });

        // ── New User Joined ──
        socket.on("user-joined", (user: {
            socketId: string; name: string; initials: string; isMuted: boolean; isVideoOff: boolean;
        }) => {
            set((s) => ({
                participants: {
                    ...s.participants,
                    [user.socketId]: {
                        id: user.socketId,
                        name: user.name,
                        initials: user.initials,
                        isMuted: user.isMuted,
                        isVideoOff: user.isVideoOff,
                        stream: null,
                        isLocal: false,
                    },
                },
            }));
        });

        // ── User Left ──
        socket.on("user-left", ({ socketId }: { socketId: string }) => {
            closePeerConnection(socketId);
            set((s) => {
                const updated = { ...s.participants };
                delete updated[socketId];
                return { participants: updated };
            });
        });

        // ── WebRTC: Receive Offer ──
        socket.on("offer", async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
            console.log(`📥 Received offer from ${from}`);
            const { localStream } = get();
            // isOfferer = false → will use ondatachannel
            const pc = createPeerConnection(from, socket, localStream, set, get, false);

            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socket.emit("answer", { to: from, answer });
            console.log(`📤 Sent answer to ${from}`);
        });

        // ── WebRTC: Receive Answer ──
        socket.on("answer", async ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
            console.log(`📥 Received answer from ${from}`);
            const pc = peerConnections.get(from);
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
            }
        });

        // ── WebRTC: Receive ICE Candidate ──
        socket.on("ice-candidate", async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
            const pc = peerConnections.get(from);
            if (pc && candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
        });

        // ── Chat ──
        socket.on("receive-message", (msg: {
            id: string; sender: string; initials: string; text: string; timestamp: string;
        }) => {
            const chatMsg: ChatMessage = {
                ...msg,
                timestamp: new Date(msg.timestamp),
            };
            set((s) => {
                if (s.messages.find((m) => m.id === chatMsg.id)) return s;
                return { messages: [...s.messages, chatMsg] };
            });
        });

        // ── Media State ──
        socket.on("user-toggle-audio", ({ socketId, isMuted }: { socketId: string; isMuted: boolean }) => {
            set((s) => {
                const user = s.participants[socketId];
                if (!user) return s;
                return { participants: { ...s.participants, [socketId]: { ...user, isMuted } } };
            });
        });

        socket.on("user-toggle-video", ({ socketId, isVideoOff }: { socketId: string; isVideoOff: boolean }) => {
            set((s) => {
                const user = s.participants[socketId];
                if (!user) return s;
                return { participants: { ...s.participants, [socketId]: { ...user, isVideoOff } } };
            });
        });
    },

    /* Cleanup socket listeners */
    cleanupSocketListeners: () => {
        const socket = getSocket();
        socket.off("connect");
        socket.off("disconnect");
        socket.off("room-users");
        socket.off("user-joined");
        socket.off("user-left");
        socket.off("offer");
        socket.off("answer");
        socket.off("ice-candidate");
        socket.off("receive-message");
        socket.off("user-toggle-audio");
        socket.off("user-toggle-video");
    },
}));
