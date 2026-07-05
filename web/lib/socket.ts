import { io, Socket } from "socket.io-client";
import { useMeetingStore } from "@/store/use-meeting-store";
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL;

let socket: Socket | null = null;

export const getSocket = (): Socket => {
    if (!socket) {
        socket = io(SOCKET_URL, {
            autoConnect: false,
            transports: ["websocket"],
        });
        useMeetingStore.getState().setupSocketListeners(socket);
    }
    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};
