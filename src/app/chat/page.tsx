"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { IconSend, IconTerminal2, IconArrowLeft, IconUser, IconLoader2 } from "@tabler/icons-react";

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
}

export default function ChatConsole() {
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "agent", content: "Antigravity CLI connected. Server access granted. How can I assist you today?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userMsg.content }),
      });
      
      const data = await res.json();
      
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "agent",
        content: data.response || data.error || "No response received."
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "agent",
        content: "Error: Could not connect to the local Antigravity daemon."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans">
      {/* Header */}
      <header className="h-14 border-b border-white/10 bg-[#0a0a0a] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-neutral-400 hover:text-white transition-colors flex items-center gap-1 text-sm">
            <IconArrowLeft size={16} />
            <span>Back</span>
          </Link>
          <div className="h-4 w-[1px] bg-white/10 mx-2" />
          <div className="flex items-center gap-2 text-emerald-400">
            <IconTerminal2 size={18} />
            <span className="font-mono text-sm font-medium tracking-wide">AGY CONSOLE</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">System Online</span>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-32 max-w-4xl mx-auto w-full">
        <div className="space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              
              {/* Agent Avatar */}
              {msg.role === 'agent' && (
                <div className="w-8 h-8 rounded-md bg-[#007AFF]/20 border border-[#007AFF]/30 flex items-center justify-center shrink-0 mt-1">
                  <IconTerminal2 size={16} className="text-[#007AFF]" />
                </div>
              )}

              {/* Message Bubble */}
              <div className={`relative max-w-[85%] rounded-2xl px-5 py-3.5 text-sm ${
                msg.role === 'user' 
                  ? 'bg-neutral-800 text-white border border-white/5 rounded-tr-sm'
                  : 'bg-transparent text-neutral-200 font-mono text-[13px] leading-relaxed whitespace-pre-wrap'
              }`}>
                {msg.content}
              </div>

              {/* User Avatar */}
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-neutral-800 border border-white/10 flex items-center justify-center shrink-0 mt-1">
                  <IconUser size={16} className="text-neutral-400" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-4 justify-start">
              <div className="w-8 h-8 rounded-md bg-[#007AFF]/20 border border-[#007AFF]/30 flex items-center justify-center shrink-0 mt-1">
                <IconTerminal2 size={16} className="text-[#007AFF]" />
              </div>
              <div className="flex items-center gap-2 text-neutral-500 text-sm font-mono h-10">
                <IconLoader2 size={16} className="animate-spin" />
                Processing request...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black to-transparent">
        <div className="max-w-4xl mx-auto relative">
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message the agent... (e.g. 'Restart the server', 'Check logs')"
              disabled={isLoading}
              className="w-full bg-[#141414] border border-white/10 focus:border-[#007AFF]/50 focus:ring-1 focus:ring-[#007AFF]/30 rounded-xl pl-4 pr-12 py-3.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 h-9 w-9 rounded-lg bg-[#007AFF] text-white flex items-center justify-center hover:bg-[#0A84FF] transition-colors disabled:opacity-30 disabled:hover:bg-[#007AFF]"
            >
              <IconSend size={16} stroke={2.5} />
            </button>
          </form>
          <div className="text-center mt-3">
            <span className="text-[10px] text-neutral-600 font-mono">Secured Antigravity Bridge • End-to-End Encrypted</span>
          </div>
        </div>
      </div>
    </div>
  );
}
