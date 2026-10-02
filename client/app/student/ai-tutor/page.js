"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { Bot, Loader2, Send, Sparkles, User } from "lucide-react";
import { apiFetch } from "@/lib/api";
import Markdown from "@/components/Markdown";
import { AiAllowanceBar, useAiAllowance } from "@/components/AiAllowance";

export default function AITutorPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const allowance = useAiAllowance();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading || allowance.exhausted) return;

    const userMsg = { role: "user", content: input.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const data = await apiFetch("/api/ai/tutor", {
        method: "POST",
        body: { message: userMsg.content, subject: subject || undefined },
        timeoutMs: 60000,
      });
      const reply = data.reply || data.response || data.content || JSON.stringify(data);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      allowance.track(data.usage);
    } catch (err) {
      if (err.status === 429 && err.data?.usage) {
        // Out of attempts: give the question back so it can be asked after the reset.
        allowance.trackError(err);
        setMessages((m) => m.slice(0, -1));
        setInput(userMsg.content);
        return;
      }
      toast.error(err.message);
      setMessages((m) => [...m, { role: "assistant", content: "Sorry, I couldn't process that. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col" style={{ height: "calc(100dvh - 12rem)" }}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">AI Tutor</h1>
            <p className="text-sm text-zinc-500">Ask questions and learn with AI assistance.</p>
          </div>
        </div>
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
        >
          <option value="">Any subject</option>
          <option value="Mathematics">Mathematics</option>
          <option value="Science">Science</option>
          <option value="English">English</option>
          <option value="History">History</option>
          <option value="Geography">Geography</option>
          <option value="Physics">Physics</option>
          <option value="Chemistry">Chemistry</option>
          <option value="Biology">Biology</option>
        </select>
      </div>

      <AiAllowanceBar usage={allowance.usage} onReset={allowance.reload} className="mb-3" />

      <div className="flex-1 overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="space-y-4 p-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                <Bot className="h-8 w-8 text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-zinc-600">Ask me anything about your subjects!</p>
              <p className="mt-1 text-xs text-zinc-400">I can explain concepts, solve problems, and help you study.</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                  <Bot className="h-4 w-4 text-emerald-700" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-primary-600 text-white"
                    : "border border-zinc-100 bg-zinc-50 text-zinc-700"
                }`}
              >
                {msg.role === "assistant" && (
                  <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-700">
                    <Sparkles className="h-2.5 w-2.5" /> AI Generated
                  </span>
                )}
                {msg.role === "assistant" ? (
                  <Markdown compact>{msg.content}</Markdown>
                ) : (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100">
                  <User className="h-4 w-4 text-primary-700" />
                </div>
              )}
            </motion.div>
          ))}

          {loading && (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <Bot className="h-4 w-4 text-emerald-700" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={allowance.exhausted ? "Daily AI attempts used up — come back after the reset" : "Type your question..."}
          disabled={loading || allowance.exhausted}
          className="flex-1 rounded-xl border border-zinc-300 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !input.trim() || allowance.exhausted}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
