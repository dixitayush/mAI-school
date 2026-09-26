"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { ShieldCheck, Loader2, Check, X } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function ParentConsentPage() {
  const [consents, setConsents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/consent/types")
      .then((data) => setConsents(data.consent_types || data.types || []))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  const [children, setChildren] = useState([]);

  useEffect(() => {
    apiFetch("/api/parents/children")
      .then((data) => setChildren(data.children || []))
      .catch(() => {});
  }, []);

  const respond = async (consentId, granted) => {
    const studentId = children[0]?.id;
    if (!studentId) return toast.error("No child linked to your account");
    try {
      await apiFetch("/api/consent/record", { method: "POST", body: { consent_type_id: consentId, student_id: studentId, granted } });
      toast.success(granted ? "Consent granted" : "Consent declined");
      const data = await apiFetch("/api/consent/types");
      setConsents(data.consent_types || data.types || []);
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><ShieldCheck className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Consent Forms</h1>
          <p className="text-sm text-zinc-500">Review and respond to consent requests from the school.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>
      ) : consents.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white py-16 text-center text-sm text-zinc-400 shadow-sm">No consent requests at this time.</div>
      ) : (
        <div className="space-y-3">
          {consents.map((c) => (
            <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-zinc-900">{c.name || c.title}</p>
                  <p className="mt-1 text-sm text-zinc-600">{c.description}</p>
                  {c.required && <span className="mt-2 inline-block rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">Required</span>}
                </div>
                {c.response != null ? (
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${c.response ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                    {c.response ? "Granted" : "Declined"}
                  </span>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => respond(c.id, true)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                      <Check className="h-3.5 w-3.5" /> Grant
                    </button>
                    <button onClick={() => respond(c.id, false)} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">
                      <X className="h-3.5 w-3.5" /> Decline
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
