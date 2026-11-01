import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Starship",
  description: "A spaceship cockpit for your AI assistant sessions",
  appleWebApp: { capable: true, title: "Starship", statusBarStyle: "black" },
};

/** 앱으로 설치했을 때 창 머리 색. manifest의 theme_color와 같다. */
export const viewport: Viewport = { themeColor: "#0b1020" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
