"use client";
import { useState } from "react";

export default function AiChat() {
  const [messages, setMessages] = useState<{role: 'user' | 'ai', content: string}[]>([]);
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput("");

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'ai', content: data.reply || data.error }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', content: "Connection error" }]);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700"
      >
        Chat AI
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-80 bg-white shadow-xl rounded-lg border border-gray-200 flex flex-col h-96">
      <div className="bg-slate-900 text-white p-3 flex justify-between items-center rounded-t-lg">
        <h3 className="font-semibold">AI Assistant</h3>
        <button onClick={() => setIsOpen(false)} className="text-gray-300 hover:text-white">&times;</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`text-sm ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
            <span className={`inline-block p-2 rounded-lg ${m.role === 'user' ? 'bg-blue-100 text-blue-900' : 'bg-gray-100 text-gray-800'}`}>
              {m.content}
            </span>
          </div>
        ))}
      </div>
      <form onSubmit={sendMessage} className="p-3 border-t flex">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 border rounded-l-lg p-2 text-sm focus:outline-none" 
          placeholder="Ask something..."
        />
        <button type="submit" className="bg-blue-600 text-white px-3 rounded-r-lg hover:bg-blue-700">Send</button>
      </form>
    </div>
  );
}
