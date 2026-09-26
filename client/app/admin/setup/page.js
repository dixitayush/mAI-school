"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { Settings, Loader2, CheckCircle, Circle, Rocket } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function SetupPage() {
  const [checklist, setChecklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(null);

  useEffect(() => {
    apiFetch("/api/setup")
      .then((data) => setChecklist(data.checklist || []))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  const markComplete = async (item) => {
    setCompleting(item);
    try {
      await apiFetch(`/api/setup/${item}`, { method: "PATCH" });
      toast.success(`${item.replace(/_/g, " ")} marked complete`);
      const data = await apiFetch("/api/setup");
      setChecklist(data.checklist || []);
    } catch (err) { toast.error(err.message); }
    finally { setCompleting(null); }
  };

  const completedCount = checklist.filter((c) => c.completed).length;
  const progress = checklist.length ? Math.round((completedCount / checklist.length) * 100) : 0;

  const ITEM_LABELS = {
    school_profile: "Complete School Profile",
    admin_account: "Set Up Admin Account",
    academic_year: "Configure Academic Year",
    classes: "Create Classes",
    subjects: "Add Subjects",
    teachers: "Add Teachers",
    students: "Enroll Students",
    fee_structure: "Set Up Fee Structure",
    parent_invitations: "Invite Parents",
    attendance_rules: "Configure Attendance Rules",
    branding: "Customize Branding",
    email_verification: "Verify Email Settings",
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700"><Rocket className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">School Setup</h1>
          <p className="text-sm text-zinc-500">Complete the checklist to go live.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-zinc-900">Progress</p>
              <p className="text-sm font-bold text-primary-600">{progress}%</p>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-xs text-zinc-500">{completedCount} of {checklist.length} steps completed</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            {checklist.map((item, i) => (
              <div key={item.item} className={`flex items-center gap-4 px-5 py-4 ${i < checklist.length - 1 ? "border-b border-zinc-100" : ""}`}>
                {item.completed ? (
                  <CheckCircle className="h-6 w-6 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="h-6 w-6 shrink-0 text-zinc-300" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${item.completed ? "text-zinc-500 line-through" : "text-zinc-900"}`}>
                    {ITEM_LABELS[item.item] || item.item.replace(/_/g, " ")}
                  </p>
                  {item.completed_at && <p className="text-[10px] text-zinc-400">Completed {new Date(item.completed_at).toLocaleDateString()}</p>}
                </div>
                {!item.completed && (
                  <button onClick={() => markComplete(item.item)} disabled={completing === item.item}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100 disabled:opacity-60">
                    {completing === item.item ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />} Complete
                  </button>
                )}
              </div>
            ))}
          </div>

          {progress === 100 && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center shadow-sm">
              <Rocket className="mx-auto h-8 w-8 text-emerald-600" />
              <p className="mt-2 font-semibold text-emerald-800">All set! Your school is ready to go live.</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
