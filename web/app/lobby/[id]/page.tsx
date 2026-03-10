"use client";

import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/header";
import { useMeetingStore } from "@/store/use-meeting-store";
import VideoPreview from "@/components/Video-preview";

export default function LobbyPage() {
    const params = useParams();
    const router = useRouter();
    const nameRef = useRef<HTMLInputElement | null>(null);
    const roomId = params.id as string;


    const {
        setUserName, setRoomId,
        joinMeeting
    } = useMeetingStore();

    // Set room ID on mount
    useEffect(() => {
        setRoomId(roomId);
    }, [roomId, setRoomId]);




    const handleJoin = () => {
        const name = nameRef.current?.value
        if (name!.trim()) {
            setUserName(name!.trim());
            joinMeeting();
            router.push(`/meeting/${roomId}`);
        }
    };



    return (
        <div className="min-h-screen bg-muted flex flex-col">
            <Header />

            <div className="flex-1 flex items-center justify-center p-6 md:p-12">
                <div className="w-full max-w-5xl grid md:grid-cols-5 gap-8 items-center animate-fade-in">
                    {/* Video preview — takes 3 columns */}
                    <VideoPreview />

                    {/* Join panel — takes 2 columns */}
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
