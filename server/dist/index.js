import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:3000", "https://s362ttbl-3000.inc1.devtunnels.ms"],
        methods: ["GET", "POST"],
        credentials: true,
    },
});
// Track users by room
const rooms = new Map();
//romms= roomID => {socketID => {socketID,name, initials, isMuted, isVideoOff}}
/* ── Helpers ── */
const getInitials = (name) => name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
/* ── Socket Events ── */
io.on("connection", (socket) => {
    console.log("✅ user connected:", socket.id);
    let currentRoom = null;
    /* ── Join Room ── */
    socket.on("join-room", ({ roomId, userName, isMuted, isVideoOff }) => {
        currentRoom = roomId;
        socket.join(roomId);
        const user = {
            socketId: socket.id,
            name: userName,
            initials: getInitials(userName),
            isMuted: isMuted,
            isVideoOff: isVideoOff,
        };
        // Add user to room map
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Map());
        }
        rooms.get(roomId).set(socket.id, user);
        // Send existing users to the new joiner
        const existingUsers = Array.from(rooms.get(roomId).values()).filter((u) => u.socketId !== socket.id);
        if (existingUsers.length > 0) {
            console.log("existingUsers", existingUsers);
            socket.emit("room-users", existingUsers);
        }
        // Broadcast new user to others in the room
        socket.to(roomId).emit("user-joined", user);
        console.log(`👤 ${userName} joined room ${roomId} (${rooms.get(roomId).size} users)`);
    });
    /* ── Leave Room ── */
    socket.on("leave-room", () => {
        if (currentRoom && rooms.has(currentRoom)) {
            rooms.get(currentRoom).delete(socket.id);
            socket.to(currentRoom).emit("user-left", { socketId: socket.id });
            // Clean up empty rooms
            if (rooms.get(currentRoom).size === 0) {
                rooms.delete(currentRoom);
            }
            console.log(`👋 ${socket.id} left room ${currentRoom}`);
            socket.leave(currentRoom);
            currentRoom = null;
        }
    });
    /* ── Chat ── */
    socket.on("send-message", ({ roomId, text, sender, initials }) => {
        const message = {
            id: `msg-${Date.now()}-${socket.id}`,
            sender,
            initials,
            text,
            timestamp: new Date().toISOString(),
        };
        // Broadcast to everyone in the room (including sender)
        io.to(roomId).emit("receive-message", message);
    });
    /* ── Media State ── */
    socket.on("toggle-audio", ({ roomId, isMuted }) => {
        if (rooms.has(roomId) && rooms.get(roomId).has(socket.id)) {
            rooms.get(roomId).get(socket.id).isMuted = isMuted;
        }
        socket.to(roomId).emit("user-toggle-audio", { socketId: socket.id, isMuted });
    });
    socket.on("toggle-video", ({ roomId, isVideoOff }) => {
        if (rooms.has(roomId) && rooms.get(roomId).has(socket.id)) {
            rooms.get(roomId).get(socket.id).isVideoOff = isVideoOff;
        }
        socket.to(roomId).emit("user-toggle-video", { socketId: socket.id, isVideoOff });
    });
    /* ── WebRTC Signaling ── */
    socket.on("offer", ({ to, offer }) => {
        socket.to(to).emit("offer", { from: socket.id, offer });
    });
    socket.on("answer", ({ to, answer }) => {
        socket.to(to).emit("answer", { from: socket.id, answer });
    });
    socket.on("ice-candidate", ({ to, candidate }) => {
        socket.to(to).emit("ice-candidate", { from: socket.id, candidate });
    });
    /* ── Disconnect ── */
    socket.on("disconnect", () => {
        if (currentRoom && rooms.has(currentRoom)) {
            rooms.get(currentRoom).delete(socket.id);
            socket.to(currentRoom).emit("user-left", { socketId: socket.id });
            if (rooms.get(currentRoom).size === 0) {
                rooms.delete(currentRoom);
            }
            console.log(`❌ ${socket.id} disconnected from room ${currentRoom}`);
        }
        else {
            console.log(`❌ ${socket.id} disconnected`);
        }
    });
});
app.get("/", (req, res) => {
    res.send("OK!");
});
server.listen(3001, () => {
    console.log("🚀 server is running on http://localhost:3001");
});
//# sourceMappingURL=index.js.map