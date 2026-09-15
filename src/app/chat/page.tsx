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
      <header className="h-16 border-b border-white/10 bg-[#0a0a0c]/90 backdrop-blur-xl flex items-center justify-between px-4 sm:px-6 shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link href="/login" className="min-h-[44px] px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-mono border border-white/10">
            <IconArrowLeft size={16} className="text-[#007AFF]" />
            <span>Back</span>
          </Link>
          <div className="h-4 w-[1px] bg-white/10 mx-1" />
          <div className="flex items-center gap-2 text-emerald-400">
            <IconTerminal2 size={18} />
            <span className="font-mono text-xs sm:text-sm font-semibold tracking-wider">AGY CONSOLE</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">System Online</span>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-32 max-w-4xl mx-auto w-full">
        <div className="space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              
              {/* Agent Avatar */}
              {msg.role === 'agent' && (
                <div className="w-9 h-9 rounded-xl bg-[#007AFF]/20 border border-[#007AFF]/30 flex items-center justify-center shrink-0 mt-1 shadow-inner">
                  <IconTerminal2 size={18} className="text-[#007AFF]" />
                </div>
              )}

              {/* Message Bubble */}
              <div className={`relative max-w-[85%] rounded-2xl px-5 py-3.5 text-sm ${
                msg.role === 'user' 
                  ? 'bg-neutral-800 text-white border border-white/10 rounded-tr-sm'
                  : 'bg-[#141418]/90 text-neutral-200 font-mono text-[13px] leading-relaxed whitespace-pre-wrap border border-white/10 rounded-tl-sm shadow-md'
              }`}>
                {msg.content}
              </div>

              {/* User Avatar */}
              {msg.role === 'user' && (
                <div className="w-9 h-9 rounded-xl bg-neutral-800 border border-white/10 flex items-center justify-center shrink-0 mt-1">
                  <IconUser size={18} className="text-neutral-400" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-4 justify-start">
              <div className="w-9 h-9 rounded-xl bg-[#007AFF]/20 border border-[#007AFF]/30 flex items-center justify-center shrink-0 mt-1">
                <IconTerminal2 size={18} className="text-[#007AFF]" />
              </div>
              <div className="flex items-center gap-2 text-neutral-400 text-xs font-mono h-10">
                <IconLoader2 size={16} className="animate-spin text-[#007AFF]" />
                <span>Processing request...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/90 to-transparent backdrop-blur-sm z-20">
        <div className="max-w-4xl mx-auto relative">
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message the agent... (e.g. 'Restart the server', 'Check logs')"
              disabled={isLoading}
              className="w-full min-h-[48px] h-13 bg-[#141418] border border-white/15 focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]/40 rounded-2xl pl-4 pr-14 text-sm text-white placeholder:text-neutral-500 focus:outline-none transition-all disabled:opacity-50 font-sans shadow-lg"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 h-10 w-10 min-h-[40px] min-w-[40px] rounded-xl bg-[#007AFF] hover:bg-[#0A84FF] text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:hover:bg-[#007AFF] active:scale-95 cursor-pointer shadow-md"
              title="Send message"
            >
              <IconSend size={18} stroke={2.5} />
            </button>
          </form>
          <div className="text-center mt-2.5">
            <span className="text-[10px] text-neutral-500 font-mono">Secured Antigravity Bridge • End-to-End Encrypted</span>
          </div>
        </div>
      </div>
    </div>
  );
}
