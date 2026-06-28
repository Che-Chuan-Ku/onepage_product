import type { Metadata, Viewport } from "next";
import "./globals.css";
import { MswProvider } from "@/mocks/MswProvider";
import { ToastHost } from "@/components/Toast";

export const metadata: Metadata = {
  title: "五子棋 Gomoku",
  description: "經典對弈 · 15×15 標準棋盤 · 支援 Swap2 公平開局",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        <MswProvider>
          {children}
          <ToastHost />
        </MswProvider>
      </body>
    </html>
  );
}
