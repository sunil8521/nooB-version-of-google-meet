import { Socket } from "socket.io-client";
import { toast } from "sonner";
import { useMeetingStore, ChatMessage, Participant } from "@/store/use-meeting-store";
import { getSocket } from "./socket";

const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
    ],
};

const CHUNK_SIZE = 16384; // 16KB

class WebRTCManager {
    public peerConnections = new Map<string, RTCPeerConnection>();
    public dataChannels = new Map<string, RTCDataChannel>();
    public savedCameraTrack: MediaStreamTrack | null = null;

    private fileReceiveState = new Map<string, {
        chunks: ArrayBuffer[];
        receivedSize: number;
        fileName: string;
        fileSize: number;
        fileType: string;
    }>();

    private formatFileSize(bytes: number) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    private handleDataChannelMessage(peerId: string, event: MessageEvent) {
        if (typeof event.data === "string") {
            const parsed = JSON.parse(event.data);
            if (parsed.type === "file-meta") {
                this.fileReceiveState.set(peerId, {
                    chunks: [],
                    receivedSize: 0,
                    fileName: parsed.fileName,
                    fileSize: parsed.fileSize,
                    fileType: parsed.fileType,
                });
                console.log(`📁 Receiving file "${parsed.fileName}" from ${peerId}`);
                return;
            }

            if (parsed.type === "file-complete") {
                const state = this.fileReceiveState.get(peerId);
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

                const store = useMeetingStore.getState();
                if (!store.messages.find((m) => m.id === msg.id)) {
                    useMeetingStore.setState({ messages: [...store.messages, msg] });
                }

                this.fileReceiveState.delete(peerId);
                return;
            }
            return;
        }

        const state = this.fileReceiveState.get(peerId);
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

    private setupDataChannel(channel: RTCDataChannel, peerId: string) {
        channel.binaryType = "arraybuffer";
        channel.onopen = () => {
            console.log(`📡 Data channel open with ${peerId}`);
            this.dataChannels.set(peerId, channel);
        };
        channel.onclose = () => {
            console.log(`📡 Data channel closed with ${peerId}`);
            this.dataChannels.delete(peerId);
            if (this.fileReceiveState.has(peerId)) {
                toast.dismiss(`file-progress-${peerId}`);
                this.fileReceiveState.delete(peerId);
            }
        };
        channel.onmessage = (event) => {
            this.handleDataChannelMessage(peerId, event);
        };
    }

    private createPeerConnection(peerId: string, socket: Socket, isOfferer: boolean): RTCPeerConnection {
        if (this.peerConnections.has(peerId)) {
            this.peerConnections.get(peerId)!.close();
            this.dataChannels.delete(peerId);
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);
        this.peerConnections.set(peerId, pc);

        const store = useMeetingStore.getState();
        if (store.localStream) {
            store.localStream.getTracks().forEach((track) => {
                pc.addTrack(track, store.localStream!);
            });
        }

        const transceivers = pc.getTransceivers();
        if (!transceivers.some(t => t.receiver.track.kind === "audio")) pc.addTransceiver("audio", { direction: "recvonly" });
        if (!transceivers.some(t => t.receiver.track.kind === "video")) pc.addTransceiver("video", { direction: "recvonly" });

        if (isOfferer) {
            const channel = pc.createDataChannel("file-transfer", { ordered: true });
            this.setupDataChannel(channel, peerId);
        } else {
            pc.ondatachannel = (event) => {
                this.setupDataChannel(event.channel, peerId);
            };
        }

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("ice-candidate", { to: peerId, candidate: event.candidate });
            }
        };

        pc.ontrack = (event) => {
            const track = event.track;
            const currentState = useMeetingStore.getState();
            const user = currentState.participants[peerId];
            if (!user) return;

            const existingTracks = user.stream ? user.stream.getTracks() : [];
            if (existingTracks.find((t) => t.id === track.id)) return;

            const newStream = new MediaStream([...existingTracks, track]);
            useMeetingStore.setState({
                participants: {
                    ...currentState.participants,
                    [peerId]: { ...user, stream: newStream },
                }
            });
        };

        return pc;
    }

    public async createAndSendOffer(peerId: string, socket: Socket) {
        const pc = this.createPeerConnection(peerId, socket, true);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", { to: peerId, offer });
    }

    public closePeerConnection(peerId: string) {
        const pc = this.peerConnections.get(peerId);
        if (pc) {
            pc.close();
            this.peerConnections.delete(peerId);
            this.dataChannels.delete(peerId);
            this.fileReceiveState.delete(peerId);
        }
    }

    public closeAllPeerConnections() {
        this.peerConnections.forEach((pc) => pc.close());
        this.peerConnections.clear();
        this.dataChannels.clear();
        this.fileReceiveState.clear();
    }

    public setupSocketListeners(socket: Socket) {
        socket.on("connect", () => {
            useMeetingStore.setState({ isConnected: true });
        });

        socket.on("disconnect", () => {
            useMeetingStore.setState({ isConnected: false });
        });

        socket.on("room-users", (users: Array<any>) => {
            const state = useMeetingStore.getState();
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
            useMeetingStore.setState({ participants: updated });

            users.forEach((u) => {
                this.createAndSendOffer(u.socketId, socket);
            });
        });

        socket.on("user-joined", (user: any) => {
            const state = useMeetingStore.getState();
            useMeetingStore.setState({
                participants: {
                    ...state.participants,
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
            });
        });

        socket.on("user-left", ({ socketId }: { socketId: string }) => {
            this.closePeerConnection(socketId);
            const state = useMeetingStore.getState();
            const updated = { ...state.participants };
            delete updated[socketId];
            useMeetingStore.setState({ participants: updated });
        });

        socket.on("offer", async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
            const pc = this.createPeerConnection(from, socket, false);
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("answer", { to: from, answer });
        });

        socket.on("answer", async ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
            const pc = this.peerConnections.get(from);
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
            }
        });

        socket.on("ice-candidate", async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
            const pc = this.peerConnections.get(from);
            if (pc && candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
        });

        socket.on("receive-message", (msg: any) => {
            const chatMsg: ChatMessage = {
                ...msg,
                timestamp: new Date(msg.timestamp),
            };
            const state = useMeetingStore.getState();
            if (!state.messages.find((m) => m.id === chatMsg.id)) {
                useMeetingStore.setState({ messages: [...state.messages, chatMsg] });
            }
        });

        socket.on("user-toggle-audio", ({ socketId, isMuted }: { socketId: string; isMuted: boolean }) => {
            const state = useMeetingStore.getState();
            const user = state.participants[socketId];
            if (user) {
                useMeetingStore.setState({
                    participants: { ...state.participants, [socketId]: { ...user, isMuted } }
                });
            }
        });

        socket.on("user-toggle-video", ({ socketId, isVideoOff }: { socketId: string; isVideoOff: boolean }) => {
            const state = useMeetingStore.getState();
            const user = state.participants[socketId];
            if (user) {
                useMeetingStore.setState({
                    participants: { ...state.participants, [socketId]: { ...user, isVideoOff } }
                });
            }
        });
    }

    public cleanupSocketListeners() {
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
    }

    public async toggleScreenShare() {
        const store = useMeetingStore.getState();
        const { isScreenSharing, localStream, selfId, roomId } = store;

        if (isScreenSharing) {
            const cameraTrack = this.savedCameraTrack;
            if (cameraTrack && localStream) {
                this.peerConnections.forEach((pc) => {
                    const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
                    if (videoSender) {
                        videoSender.replaceTrack(cameraTrack);
                    }
                });

                const screenTrack = localStream.getVideoTracks()[0];
                if (screenTrack && screenTrack !== cameraTrack) {
                    screenTrack.stop();
                }

                localStream.getVideoTracks().forEach((t) => localStream.removeTrack(t));
                localStream.addTrack(cameraTrack);

                const newStream = new MediaStream(localStream.getTracks());
                useMeetingStore.setState({
                    isScreenSharing: false,
                    participants: selfId ? {
                        ...store.participants,
                        [selfId]: { ...store.participants[selfId], stream: newStream },
                    } : store.participants,
                });
            } else {
                useMeetingStore.setState({ isScreenSharing: false });
            }
            this.savedCameraTrack = null;

            const socket = getSocket();
            if (socket.connected) {
                socket.emit("toggle-video", { roomId, isVideoOff: store.isVideoOff });
            }
            return;
        }

        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false,
            });

            const screenTrack = screenStream.getVideoTracks()[0];
            if (!screenTrack) return;

            if (localStream) {
                this.savedCameraTrack = localStream.getVideoTracks()[0] || null;
            }

            this.peerConnections.forEach((pc) => {
                const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
                if (videoSender) {
                    videoSender.replaceTrack(screenTrack);
                }
            });

            if (localStream) {
                localStream.getVideoTracks().forEach((t) => localStream.removeTrack(t));
                localStream.addTrack(screenTrack);
            }

            const newStream = localStream ? new MediaStream(localStream.getTracks()) : null;
            useMeetingStore.setState({
                isScreenSharing: true,
                participants: selfId ? {
                    ...store.participants,
                    [selfId]: { ...store.participants[selfId], stream: newStream },
                } : store.participants,
            });

            screenTrack.onended = () => {
                this.toggleScreenShare(); // Revert
            };

            toast.success("Screen sharing started");
        } catch (err) {
            console.log("Screen share cancelled:", err);
        }
    }

    public sendFile(file: File) {
        const store = useMeetingStore.getState();
        const { userName, selfId } = store;
        
        const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
        const initials = getInitials(userName || "You");
        const messageId = `file-${Date.now()}-${selfId}`;

        if (this.dataChannels.size === 0) {
            toast.error("No peers connected", { description: "Wait for someone to join before sending files" });
            return;
        }

        this.dataChannels.forEach((channel, peerId) => {
            if (channel.readyState !== "open") return;

            channel.send(JSON.stringify({
                type: "file-meta",
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
            }));

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
                    if (channel.bufferedAmount > CHUNK_SIZE * 8) {
                        setTimeout(readSlice, 50);
                    } else {
                        readSlice();
                    }
                } else {
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
        useMeetingStore.setState({ messages: [...store.messages, selfMsg] });
    }
}

export const webRTCManager = new WebRTCManager();
