"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Loader2, Bot, User } from "lucide-react";
import { apiFetch } from "@/lib/api";

const ROLE_GREETING = {
  student:
    "Hi! Ask me about your attendance, assignments, timetable, upcoming online classes, exams or fees.",
  teacher:
    "Hi! Ask me about your classes' attendance, assignment submissions or upcoming sessions.",
  admin:
    "Hi! Ask me about school attendance, fees, upcoming exams and holidays.",
  principal:
    "Hi! Ask me about school attendance, fees, upcoming exams and holidays.",
  opsadmin:
    "Hi! Ask me about fee collection, outstanding dues, payroll and expenses.",
  mai_admin: "Hi! How can I help?",
};

const SUGGESTIONS = {
  student: ["What's my attendance percentage?", "Any assignments due soon?", "When is my next online class?"],
  teacher: ["How is my class attendance?", "Which submissions need grading?", "Any online classes today?"],
  admin: ["What's the overall attendance?", "Any pending fees?", "What exams are coming up?"],
  principal: ["What's the overall attendance?", "Any pending fees?", "What exams are coming up?"],
  opsadmin: ["Any pending fees?", "What's the overall attendance?", "What exams are coming up?"],
  mai_admin: [],
};

export default function ChatWidget({ userRole = "student" }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content }]);
    setSending(true);
    try {
      const data = await apiFetch("/api/chatbot", {
        method: "POST",
        body: { message: content, session_id: sessionId },
      });
      if (data.session_id) setSessionId(data.session_id);
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `⚠️ ${err.message || "Something went wrong."}`, error: true },
      ]);
    } finally {
      setSending(false);
    }
  };

  const suggestions = SUGGESTIONS[userRole] || [];

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg shadow-primary-600/30 transition hover:bg-primary-700"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-5 z-50 flex h-[min(34rem,calc(100dvh-8rem))] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
          >
            <div className="flex items-center gap-2.5 border-b border-zinc-100 bg-primary-600 px-4 py-3 text-white">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold">School Assistant</p>
                <p className="text-[11px] text-white/80">AI-powered · your data only</p>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
                      {ROLE_GREETING[userRole] || ROLE_GREETING.student}
                    </div>
                  </div>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="block w-full rounded-xl border border-primary-100 bg-primary-50/50 px-3 py-2 text-left text-xs font-medium text-primary-700 transition hover:bg-primary-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      m.role === "user" ? "bg-primary-600 text-white" : "bg-primary-50 text-primary-700"
                    }`}
                  >
                    {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div
                    className={`max-w-[78%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                      m.role === "user"
                        ? "rounded-tr-sm bg-primary-600 text-white"
                        : m.error
                          ? "rounded-tl-sm bg-red-50 text-red-700"
                          : "rounded-tl-sm bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-zinc-100 px-3 py-2.5">
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                  </div>
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-center gap-2 border-t border-zinc-100 p-3"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask something…"
                className="flex-1 rounded-full border border-zinc-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white transition hover:bg-primary-700 disabled:opacity-40"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
