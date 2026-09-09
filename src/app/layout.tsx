import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Control-Access System",
  description: "Mine Site Access & Gate Operations System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased flex h-screen bg-gray-100">
        <aside className="w-64 bg-slate-900 text-white flex flex-col">
          <div className="p-6 font-bold text-xl border-b border-slate-700 flex items-center gap-3">
            <img src="/arch-linux-mono.svg" alt="Logo" className="w-8 h-8" style={{ filter: 'invert(1)' }} />
            Control-Access
          </div>
          <nav className="flex-1 p-4 space-y-2">
            <Link
              href="/dashboard"
              className="block p-3 rounded hover:bg-slate-800 transition"
            >
              Dashboard
            </Link>
            <Link
              href="/employees"
              className="block p-3 rounded hover:bg-slate-800 transition"
            >
              Employees
            </Link>
            <Link
              href="/visitors"
              className="block p-3 rounded hover:bg-slate-800 transition"
            >
              Visitors
            </Link>
            <Link
              href="/fleet"
              className="block p-3 rounded hover:bg-slate-800 transition"
            >
              Fleet
            </Link>
            <Link
              href="/equipment"
              className="block p-3 rounded hover:bg-slate-800 transition"
            >
              Equipment
            </Link>
            <Link
              href="/approvals"
              className="block p-3 rounded hover:bg-slate-800 transition"
            >
              Approvals
            </Link>
            <Link
              href="/admin"
              className="block p-3 rounded hover:bg-slate-800 transition"
            >
              Admin Settings
            </Link>
          </nav>
        </aside>
        <main className="flex-1 overflow-auto">{children}</main>
      </body>
    </html>
  );
}
