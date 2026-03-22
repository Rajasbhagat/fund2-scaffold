import type { Metadata } from "next";
import { Rajdhani, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const rajdhani = Rajdhani({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-rajdhani',
});

const jetbrainsMono = JetBrains_Mono({
  weight: 'variable',
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  title: "FUND II — Trend Intelligence Platform",
  description: "AntiGravity Fund II | Aerospace-grade trend analysis",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${rajdhani.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-full flex flex-col bg-hud-fg text-hud-bg font-sans">
        {children}
      </body>
    </html>
  );
}
