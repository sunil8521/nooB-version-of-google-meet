"use client"
import { Mic, MicOff, Video, VideoOff, User } from "lucide-react";
import { useMeetingStore } from "@/store/use-meeting-store";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";


const VideoPreview = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const {

        isMuted, isVideoOff, localStream,
        setIsMuted, setIsVideoOff, setLocalStream,
    } = useMeetingStore();

    useEffect(() => {
        const requestMedia = async () => {
            let videoTrack = null;
            let audioTrack = null;

            try {
                const video = await navigator.mediaDevices.getUserMedia({ video: true });
                videoTrack = video.getVideoTracks()[0];
            } catch {
                toast.warning("Camera access denied", { description: "You can still join without video" });
                setIsVideoOff(true);
            }

            try {
                const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioTrack = audio.getAudioTracks()[0];
            } catch {
                toast.warning("Microphone access denied", { description: "You can still join without audio" });
                setIsMuted(true);
            }

            const tracks = [];

            if (videoTrack) tracks.push(videoTrack);
            if (audioTrack) tracks.push(audioTrack);

            if (tracks.length > 0) {
                const stream = new MediaStream(tracks);
                setLocalStream(stream);
            }
        };

        requestMedia();
    }, []);
    // Attach stream to video element
    useEffect(() => {
        if (videoRef.current && localStream) {
            videoRef.current.srcObject = localStream;
        }
    }, [localStream, isVideoOff]);

   

    const toggleMic = () => {
        if (!localStream || localStream.getAudioTracks().length === 0) {
            toast.error("Microphone not available", { description: "Please allow microphone access in your browser settings" });
            return;
        }
        const next = !isMuted

        localStream.getAudioTracks().forEach(track => {
            track.enabled = !next
        })

        setIsMuted(next);
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
    };
    return (
        <div className="md:col-span-3">
            <div
                className="relative w-full rounded-2xl overflow-hidden shadow-lg border border-border"
                style={{ aspectRatio: "4 / 3", background: localStream && !isVideoOff ? "#202124" : "white" }}
            >
                {/* Live camera preview */}
                {localStream && !isVideoOff ? (
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                    />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                        <div className="w-28 h-28 md:w-36 md:h-36 rounded-full bg-muted flex items-center justify-center">
                            <User className="w-16 h-16 md:w-20 md:h-20 text-muted-foreground/50" />
                        </div>
                    </div>
                )}

                {/* Mic & Camera controls — bottom left corner */}
                <div className="absolute bottom-4 left-4 flex gap-2">
                    <button
                        onClick={toggleMic}
                        className={cn(
                            "w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer",
                            isMuted
                                ? "bg-destructive text-white hover:bg-destructive/90"
                                : localStream && !isVideoOff
                                    ? "bg-white/20 text-white hover:bg-white/30"
                                    : "bg-foreground/10 text-foreground hover:bg-foreground/15"
                        )}
                    >
                        {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>
                    <button
                        onClick={toggleVideo}
                        className={cn(
                            "w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer",
                            isVideoOff
                                ? "bg-destructive text-white hover:bg-destructive/90"
                                : localStream && !isVideoOff
                                    ? "bg-white/20 text-white hover:bg-white/30"
                                    : "bg-foreground/10 text-foreground hover:bg-foreground/15"
                        )}
                    >
                        {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                    </button>
                </div>

                {/* Camera off badge */}
                {isVideoOff && (
                    <div className="absolute top-4 left-4">
                        <span className="text-xs bg-foreground/10 text-muted-foreground px-2.5 py-1 rounded-full">
                            Camera is off
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
}

export default VideoPreview;