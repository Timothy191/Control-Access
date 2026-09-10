"use client";

import { useState } from "react";
import Image from "next/image";
import { IconSend, IconMessageCircle, IconX } from "@tabler/icons-react";

export default function AiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("Hi boss! How can I help you manage the site today?");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    const userText = prompt.trim();
    setPrompt("");
    setResponse("...");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userText }),
      });
      const data = await res.json();
      if (data.response) {
        setResponse(data.response);
      } else {
        setResponse("Sorry, I had trouble thinking about that!");
      }
    } catch (err) {
      setResponse("Network error communicating with the backend.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-[#007AFF] shadow-lg shadow-[#007AFF]/30 flex items-center justify-center text-white hover:scale-105 transition-transform z-50 border border-white/20"
      >
        <IconMessageCircle size={28} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-end gap-4 w-[350px] sm:w-[400px]">
      <div className="flex flex-col w-full animate-in slide-in-from-bottom-5 fade-in duration-300">
        
        {/* Speech Bubble */}
        <div className="relative bg-white text-black p-4 rounded-2xl rounded-br-sm shadow-xl mb-3 text-sm font-sans min-h-[80px] max-h-[300px] overflow-y-auto">
          <button 
            onClick={() => setIsOpen(false)}
            className="absolute top-2 right-2 text-neutral-400 hover:text-black transition-colors"
          >
            <IconX size={16} />
          </button>
          
          <div className="pr-6 leading-relaxed whitespace-pre-wrap">
            {isLoading ? (
              <span className="animate-pulse">Thinking...</span>
            ) : (
              response
            )}
          </div>
          
          {/* Bubble Tail */}
          <div className="absolute -bottom-2 right-4 w-4 h-4 bg-white transform rotate-45 translate-y-1/2"></div>
        </div>

        {/* Character and Input */}
        <div className="flex gap-3 items-end">
          <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-[#007AFF] bg-white shrink-0 shadow-lg">
            <Image 
              src="/assets/anime_assistant.jpg" 
              alt="AI Assistant" 
              fill
              className="object-cover object-top"
            />
          </div>
          
          <form onSubmit={handleSubmit} className="relative w-full flex-1">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask me anything..."
              disabled={isLoading}
              className="w-full h-11 pl-4 pr-10 rounded-full bg-neutral-900 border border-white/20 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#007AFF] shadow-lg disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !prompt.trim()}
              className="absolute right-1.5 top-1.5 h-8 w-8 rounded-full bg-[#007AFF] text-white flex items-center justify-center hover:bg-[#0A84FF] transition-colors disabled:opacity-30 disabled:hover:bg-[#007AFF]"
            >
              <IconSend size={14} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
