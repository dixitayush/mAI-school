"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { MessageSquare, Plus, Loader2, Send, ArrowLeft } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function ParentCommunicationPage() {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ subject: "", message: "" });
  const endRef = useRef(null);

  const fetchThreads = async () => {
    try {
      const data = await apiFetch("/api/communication/threads");
      setThreads(data.threads || []);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchThreads(); }, []);

  const openThread = async (thread) => {
    setActiveThread(thread);
    setMsgLoading(true);
    try {
      const data = await apiFetch(`/api/communication/threads/${thread.id}/messages`);
      setMessages(data.messages || []);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) { toast.error(err.message); }
    finally { setMsgLoading(false); }
  };

  const sendReply = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/api/communication/threads/${activeThread.id}/messages`, { method: "POST", body: { body: reply } });
      setReply("");
      openThread(activeThread);
    } catch (err) { toast.error(err.message); }
    finally { setSending(false); }
  };

  const createThread = async (e) => {
    e.preventDefault();
    if (!form.subject || !form.message) return toast.error("Subject and message required");
    setCreating(true);
    try {
      const data = await apiFetch("/api/communication/threads", { method: "POST", body: form });
      toast.success("Message sent");
      setShowCreate(false);
      setForm({ subject: "", message: "" });
      fetchThreads();
      if (data.thread) openThread(data.thread);
    } catch (err) { toast.error(err.message); }
    finally { setCreating(false); }
  };

  const inputCls = "w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";

  if (activeThread) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col" style={{ height: "calc(100vh - 200px)" }}>
        <div className="mb-4 flex items-center gap-3">
          <button onClick={() => setActiveThread(null)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"><ArrowLeft className="h-5 w-5" /></button>
          <h2 className="text-lg font-bold text-zinc-900">{activeThread.subject}</h2>
        </div>
        <div className="flex-1 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          {msgLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>
          ) : messages.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-400">No messages yet.</div>
          ) : (
            <div className="space-y-4">
              {messages.map(msg => (
                <div key={msg.id} className="rounded-xl bg-zinc-50 p-4">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-sm font-semibold text-zinc-800">{msg.sender_name || "User"}</p>
                    <p className="text-xs text-zinc-400">{new Date(msg.created_at).toLocaleString()}</p>
                  </div>
                  <p className="text-sm text-zinc-700 whitespace-pre-wrap">{msg.body}</p>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>
        <form onSubmit={sendReply} className="mt-3 flex gap-2">
          <input value={reply} onChange={e => setReply(e.target.value)} placeholder="Type a message..." className={`${inputCls} flex-1`} />
          <button type="submit" disabled={sending || !reply.trim()} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700"><MessageSquare className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Messages</h1>
            <p className="text-sm text-zinc-500">Communicate with teachers and school administration.</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700">
          <Plus className="h-4 w-4" /> New Message
        </button>
      </div>

      {showCreate && (
        <motion.form initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} onSubmit={createThread} className="mb-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Subject" className={inputCls} required />
          <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Your message..." rows={3} className={inputCls} required />
          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-500 hover:text-zinc-700">Cancel</button>
          </div>
        </motion.form>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>
      ) : threads.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white py-16 text-center text-sm text-zinc-400 shadow-sm">No messages yet.</div>
      ) : (
        <div className="space-y-2">
          {threads.map(t => (
            <button key={t.id} onClick={() => openThread(t)} className="w-full rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:shadow-md">
              <p className="font-semibold text-zinc-900">{t.subject}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{t.last_message?.slice(0, 80) || "No messages"} · {t.updated_at ? new Date(t.updated_at).toLocaleDateString() : ""}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
