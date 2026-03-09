import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Challenge Leaderboard — 리더보드",
  description: "Claude Code 사용량 리더보드. 더 많이 쓰는 사람이 더 빠르게 성장합니다 🔥",
  keywords: ["claude code", "ai challenge", "leaderboard", "token usage"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
