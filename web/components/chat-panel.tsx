"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Paperclip, FileText, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/store/use-meeting-store";

interface ChatPanelProps {
    messages: ChatMessage[];
    onSendMessage: (text: string) => void;
    onSendFile: (file: File) => void;
    isOpen: boolean;
    onClose: () => void;
}

const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function ChatPanel({ messages, onSendMessage, onSendFile, isOpen, onClose }: ChatPanelProps) {
    const [text, setText] = useState("");
    const bottomRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = () => {
        if (text.trim()) {
            onSendMessage(text.trim());
            setText("");
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onSendFile(file);
            e.target.value = ""; // Reset input
        }
    };

    return (
        <div
            className={cn(
                "h-full bg-white border-l border-border flex flex-col transition-all duration-300 overflow-hidden",
                isOpen ? "w-80" : "w-0"
            )}
        >
            {isOpen && (
                <>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                        <h3 className="text-sm font-semibold text-foreground">In-call messages</h3>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors cursor-pointer"
                        >
                            <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.length === 0 && (
                            <div className="flex-1 flex items-center justify-center text-center py-12">
                                <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground">No messages yet</p>
                                    <p className="text-xs text-muted-foreground/70">
                                        Messages can only be seen by people in the call
                                    </p>
                                </div>
                            </div>
                        )}
                        {messages.map((msg) => (
                            <div key={msg.id} className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                                        <span className="text-[10px] font-semibold text-primary">{msg.initials}</span>
                                    </div>
                                    <span className="text-xs font-medium text-foreground">{msg.sender}</span>
                                    <span className="text-[10px] text-muted-foreground">
                                        {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                </div>

                                {/* File attachment */}
                                {msg.attachment ? (
                                    <div className="ml-8">
                                        <a
                                            href={msg.attachment.fileUrl}
                                            download={msg.attachment.fileName}
                                            className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors group"
                                        >
                                            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                <FileText className="w-4 h-4 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium text-foreground truncate">
                                                    {msg.attachment.fileName}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground">
                                                    {formatFileSize(msg.attachment.fileSize)}
                                                </p>
                                            </div>
                                            <Download className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                                        </a>
                                    </div>
                                ) : (
                                    <p className="text-sm text-foreground pl-8">{msg.text}</p>
                                )}
                            </div>
                        ))}
                        <div ref={bottomRef} />
                    </div>

                    {/* Input */}
                    <div className="p-3 border-t border-border">
                        <div className="flex items-center gap-2">
                            {/* File upload */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                                title="Send a file"
                            >
                                <Paperclip className="w-4 h-4" />
                            </button>

                            <input
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                placeholder="Send a message"
                                className="flex-1 h-10 px-3 text-sm bg-muted rounded-lg border-none outline-none focus:ring-2 focus:ring-primary/30"
                            />
                            <button
                                onClick={handleSend}
                                disabled={!text.trim()}
                                className="w-10 h-10 rounded-full flex items-center justify-center text-primary hover:bg-primary/10 disabled:opacity-30 transition-colors cursor-pointer"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
