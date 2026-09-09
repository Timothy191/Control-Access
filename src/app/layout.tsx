import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { SessionProvider } from "next-auth/react";
import "./globals.css";
import GlobalBackground from "@/components/layout/GlobalBackground";
import { SiteProvider } from "@/components/layout/SiteContext";

export const metadata: Metadata = {
  title: "Control-Access — Plantcor Arch System",
  description: "Mine Site Access & Gate Operations System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} dark`}>
      <body
        className={`${GeistSans.className} antialiased flex h-screen bg-transparent relative overflow-hidden font-sans`}
      >
        <GlobalBackground />
        <SessionProvider>
          <SiteProvider>{children}</SiteProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
