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
    } catch (error) {
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
        className="fixed bottom-6 right-6 bg-red-primary text-white p-4 rounded-full shadow-lg hover:bg-red-dark transition z-40"
        aria-label="Open AI chat"
      >
        Chat AI
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-80 glass-card flex flex-col h-96 z-40">
      <div className="flex justify-between items-center pb-3 border-b border-white/10">
        <h3 className="font-semibold text-text-primary">AI Assistant</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-text-secondary hover:text-text-primary transition"
          aria-label="Close AI chat"
        >
          &times;
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-sm ${m.role === "user" ? "text-right" : "text-left"}`}
          >
            <span
              className={`inline-block p-2 rounded-lg ${
                m.role === "user"
                  ? "bg-red-primary/20 text-text-primary border border-red-primary/30"
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
        className="pt-3 border-t border-white/10 flex"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 border border-steel/30 rounded-l-md bg-black/40 p-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none"
          placeholder="Ask something..."
        />
        <button
          type="submit"
          className="bg-red-primary text-white px-3 rounded-r-md hover:bg-red-dark transition"
        >
          Send
        </button>
      </form>
    </div>
  );
}
