# MeetClone — Video Meetings

A real-time video conferencing app built with **Next.js**, **Socket.IO**, and **WebRTC**. Supports multi-peer video/audio calls, in-call chat, file sharing via DataChannel, and a responsive grid layout.

## Features

- **Video & Audio Calls** — Peer-to-peer via WebRTC with STUN server NAT traversal
- **Multi-Peer Support** — Mesh topology, each user connects to every other user
- **Live Chat** — Real-time text messaging via Socket.IO
- **File Transfer** — Send/receive files directly via WebRTC DataChannel (no server upload needed)
- **Media Controls** — Toggle mic/camera on/off, synced across all peers
- **Responsive Grid** — Auto-adjusting grid up to 12 tiles; scrollable beyond 12
- **Lobby Preview** — Camera/mic preview before joining the meeting

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript |
| State | Zustand |
| Styling | Tailwind CSS 4 |
| UI Components | Radix UI, Lucide Icons |
| Real-time | Socket.IO |
| Media | WebRTC (RTCPeerConnection, DataChannel) |
| Server | Express 5, Socket.IO |

## Project Structure

```
zoom-app/
├── server/                 # Socket.IO signaling server
│   └── src/
│       └── index.ts        # Express + Socket.IO (port 3001)
└── web/                    # Next.js frontend (port 3000)
    ├── app/
    │   ├── page.tsx              # Landing page
    │   ├── lobby/[id]/page.tsx   # Pre-join lobby
    │   └── meeting/[id]/page.tsx # Meeting room
    ├── components/
    │   ├── video-tile.tsx        # Individual video tile
    │   ├── Video-preview.tsx     # Lobby camera preview
    │   ├── meeting-toolbar.tsx   # Bottom toolbar (mic, cam, chat, leave)
    │   └── chat-panel.tsx        # Chat sidebar with file transfer
    ├── store/
    │   └── use-meeting-store.ts  # Zustand store (state + WebRTC + DataChannel)
    └── lib/
        └── socket.ts             # Socket.IO client singleton
```

## Getting Started

### Prerequisites

- Node.js ≥ 18
- pnpm

### Install & Run

```bash
# 1. Clone the repo
git clone https://github.com/sunil8521/google-meet-clone.git
cd google-meet-clone

# 2. Install server dependencies
cd server
pnpm install

# 3. Install web dependencies
cd ../web
pnpm install

# 4. Start the server (terminal 1)
cd ../server
pnpm dev

# 5. Start the web app (terminal 2)
cd ../web
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Testing with Multiple Users

1. Open **two browser tabs** (or two different browsers)
2. Click **New Meeting** → copy the meeting code
3. In the second tab, paste the code and join
4. Both tabs should see each other's video + audio

## How It Works

### Signaling Flow

```
User A joins room first (alone)
User B joins → server sends "room-users: [A]" to B
B creates offer → sends to A via server
A receives offer → creates answer → sends to B
ICE candidates exchanged
Peer connection established → video/audio/data flows directly
```

### Socket Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `join-room` | Client → Server | Join a room with name & media state |
| `room-users` | Server → Client | List of existing users in the room |
| `user-joined` | Server → Client | New user notification |
| `user-left` | Server → Client | User disconnect notification |
| `offer` | Client ↔ Server | WebRTC SDP offer relay |
| `answer` | Client ↔ Server | WebRTC SDP answer relay |
| `ice-candidate` | Client ↔ Server | ICE candidate relay |
| `send-message` | Client → Server | Chat message |
| `receive-message` | Server → Client | Chat message broadcast |
| `toggle-audio` | Client ↔ Server | Mic state sync |
| `toggle-video` | Client ↔ Server | Camera state sync |

### File Transfer (DataChannel)

Files are sent **peer-to-peer** via WebRTC DataChannel — no server upload:

1. Sender picks a file → metadata JSON sent first
2. File split into **16KB chunks** → sent as ArrayBuffer
3. Receiver accumulates chunks → builds Blob → creates download URL
4. Progress toasts shown on both sides
5. Chat message with download card appears when complete

