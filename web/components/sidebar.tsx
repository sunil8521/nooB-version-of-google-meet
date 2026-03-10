"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, CirclePlay, Users, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
    { label: "Home", icon: Home, href: "/", active: true },
    { label: "Calendar", icon: Calendar, href: "#", active: false },
    { label: "Recording", icon: CirclePlay, href: "#", active: false },
    { label: "Contacts", icon: Users, href: "#", active: false },
    { label: "Whiteboards", icon: Pencil, href: "#", active: false },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-44 bg-white border-r border-border flex flex-col py-4 shrink-0 hidden md:flex">
            <nav className="flex-1 space-y-0.5 px-2">
                {navItems.map((item) => {
                    const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                                isActive
                                    ? "text-primary bg-accent"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )}
                        >
                            <item.icon className="w-4.5 h-4.5" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="px-2 mt-auto">
                <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors w-full cursor-pointer">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                    Log out
                </button>
            </div>
        </aside>
    );
}
