"use client";
import { useState } from "react";

export default function AiChat() {
  const [messages, setMessages] = useState<
    { role: "user" | "ai"; content: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input;
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setInput("");

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: data.reply || data.error },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "Connection error" },
      ]);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 min-h-[48px] min-w-[48px] px-4 py-3 bg-[#007AFF] hover:bg-[#0A84FF] text-white rounded-2xl shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95 z-50 flex items-center gap-2 font-medium text-xs sm:text-sm font-sans cursor-pointer"
        aria-label="Open AI chat"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
        </span>
        <span>AI Copilot</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-80 sm:w-96 glass-card flex flex-col h-[420px] z-50 shadow-2xl rounded-2xl border border-white/15">
      <div className="flex justify-between items-center pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#007AFF]" />
          <h3 className="font-semibold text-text-primary text-sm font-sans">Control-Access Copilot</h3>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="min-h-[36px] min-w-[36px] flex items-center justify-center text-text-secondary hover:text-text-primary rounded-lg hover:bg-white/10 transition cursor-pointer text-lg"
          aria-label="Close AI chat"
        >
          &times;
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-4 space-y-3 font-sans">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-xs sm:text-sm ${m.role === "user" ? "text-right" : "text-left"}`}
          >
            <span
              className={`inline-block p-2.5 rounded-xl ${
                m.role === "user"
                  ? "bg-[#007AFF]/25 text-white border border-[#007AFF]/40"
                  : "bg-white/10 text-text-primary border border-white/10"
              }`}
            >
              {m.content}
            </span>
          </div>
        ))}
      </div>
      <form
        onSubmit={sendMessage}
        className="pt-3 border-t border-white/10 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 h-10 border border-white/15 rounded-xl bg-black/40 px-3 text-xs sm:text-sm text-text-primary placeholder:text-neutral-500 focus:outline-none focus:border-[#007AFF]"
          placeholder="Ask Copilot something..."
        />
        <button
          type="submit"
          className="h-10 px-4 rounded-xl bg-[#007AFF] hover:bg-[#0A84FF] active:scale-[0.98] text-white text-xs font-semibold transition cursor-pointer"
        >
          Send
        </button>
      </form>
    </div>
  );
}
