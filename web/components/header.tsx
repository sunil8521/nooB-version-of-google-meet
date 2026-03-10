"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Video } from "lucide-react";
export function Header() {

    const [currentDate, setCurrentDate] = useState("");
    const [currentTime, setCurrentTime] = useState("");
    useEffect(() => {
        const update = () => {
            const now = new Date();
            setCurrentDate(
                now.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                })
            );
            setCurrentTime(
                now.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                })
            );
        };
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, []);
    return (
        <header className="flex items-center justify-between px-4 md:px-8 py-4 border-b border-border">
            <div className="flex items-center gap-2">
                <Video className="w-8 h-8 text-primary" />
                <span className="text-xl font-display font-medium text-foreground">
                    MeetMe
                </span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground hidden md:block">
                    {currentDate}
                </span>
                <span className="text-sm text-muted-foreground hidden md:block">
                    •
                </span>
                <span className="text-sm text-muted-foreground hidden md:block">
                    {currentTime}
                </span>
            </div>
        </header>
    );
}
