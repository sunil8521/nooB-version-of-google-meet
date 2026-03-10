import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MeetClone — Video Meetings",
  description: "Video calls and meetings for everyone. Connect, collaborate, and celebrate from anywhere.",
};

import { Toaster } from "sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
