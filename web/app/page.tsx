"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Video, Keyboard, Calendar, Clock, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Image from "next/image";
import { Header } from "@/components/header";


export default function HomePage() {



  const router = useRouter();
  const [meetingCode, setMeetingCode] = useState("");


  const generateRoomId = () => {
    let s = new Date().getTime().toString(36).slice(0, 9).toUpperCase()
    s = s.match(/.{1,4}/g)?.join("-") || s;

    return s;

  };

  const handleNewMeeting = () => {
    const roomId = generateRoomId();
    router.push(`/lobby/${roomId}`);
  };

  const handleJoinMeeting = () => {
    if (meetingCode.trim()) {
      const code = meetingCode.replace(/[^a-zA-Z0-9-]/g, "");
      router.push(`/lobby/${code}`);
    }
  }; //TODO: here we have handle we that room is valid or not

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header />
      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-12 md:py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left side - Text and actions */}
          <div className="space-y-8 animate-fade-in">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-medium text-foreground leading-tight">
                Video calls and meetings for everyone
              </h1>
              <p className="text-lg text-muted-foreground max-w-md">
                Connect, collaborate, and celebrate from anywhere with MeetClone
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="lg" className="gap-2 font-medium">
                    <Video className="w-5 h-5" />
                    New meeting
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem
                    onClick={handleNewMeeting}
                    className="gap-3 py-3"
                  >
                    <Video className="w-4 h-4" />
                    <div>
                      <p className="font-medium">Start an instant meeting</p>
                      <p className="text-xs text-muted-foreground">
                        Start right now
                      </p>
                    </div>
                  </DropdownMenuItem>
                  {/* <DropdownMenuItem className="gap-3 py-3">
                    <Calendar className="w-4 h-4" />
                    <div>
                      <p className="font-medium">Schedule in calendar</p>
                      <p className="text-xs text-muted-foreground">
                        Plan ahead
                      </p>
                    </div>
                  </DropdownMenuItem> */}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex gap-2 flex-1">
                <div className="relative flex-1">
                  <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    value={meetingCode}
                    onChange={(e) => setMeetingCode(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleJoinMeeting()
                    }
                    placeholder="Enter a code or link"
                    className="pl-10 h-11"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={handleJoinMeeting}
                  disabled={!meetingCode.trim()}
                  className="font-medium text-primary hover:text-primary hover:bg-primary/5"
                >
                  Join
                </Button>
              </div>
            </div>

            <div className="border-t border-border pt-6">
              <p className="text-sm text-muted-foreground">
                <a href="#" className="text-primary hover:underline">
                  Learn more
                </a>{" "}
                about MeetClone
              </p>
            </div>
          </div>

          {/* Right side - Illustration */}
          <div className="hidden md:flex items-center justify-center animate-slide-up">
            <div className="relative">
              {/* Main illustration container */}
              <div className="w-80 h-80 lg:w-96 lg:h-96 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-full flex items-center justify-center">

                <Image src="/videocall.png" alt="Illustration" width={400} height={400} />
              </div>

              {/* Floating badges */}
              <div className="absolute -top-2 -right-2 bg-card rounded-full px-3 py-1.5 shadow-md flex items-center gap-2 border border-border">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium">HD video</span>
              </div>
              <div className="absolute -bottom-2 -left-2 bg-card rounded-full px-3 py-1.5 shadow-md flex items-center gap-2 border border-border">
                <Shield className="w-4 h-4 text-success" />
                <span className="text-xs font-medium">Secure</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
          <a href="#" className="hover:text-foreground transition-colors">
            About
          </a>
          <a href="#" className="hover:text-foreground transition-colors">
            Help
          </a>
          <a href="#" className="hover:text-foreground transition-colors">
            Privacy
          </a>
          <a href="#" className="hover:text-foreground transition-colors">
            Terms
          </a>
        </div>
      </footer>
    </div>
  );
}
