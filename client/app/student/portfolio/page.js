"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { Award, Loader2, Plus, Trophy, Star, BookOpen } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function StudentPortfolioPage() {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const studentId = typeof window !== "undefined" ? localStorage.getItem("student_id") : null;
    if (!studentId) {
      setLoading(false);
      return;
    }
    Promise.all([
      apiFetch(`/api/students/${studentId}/achievements`).catch(() => ({ achievements: [] })),
      apiFetch(`/api/students/${studentId}`).catch(() => null),
    ]).then(([achData, profData]) => {
      setAchievements(achData.achievements || []);
      setProfile(profData?.student || profData);
    }).finally(() => setLoading(false));
  }, []);

  const CATEGORY_COLORS = {
    academic: { bg: "bg-blue-50", text: "text-blue-700", icon: BookOpen },
    sports: { bg: "bg-amber-50", text: "text-amber-700", icon: Trophy },
    arts: { bg: "bg-violet-50", text: "text-violet-700", icon: Star },
    leadership: { bg: "bg-emerald-50", text: "text-emerald-700", icon: Award },
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><Award className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">My Portfolio</h1>
          <p className="text-sm text-zinc-500">Achievements, awards, and skills.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>
      ) : achievements.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white py-16 text-center shadow-sm">
          <Trophy className="mx-auto h-12 w-12 text-zinc-300" />
          <p className="mt-3 text-sm text-zinc-400">No achievements recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {achievements.map((a) => {
            const cat = CATEGORY_COLORS[a.category] || CATEGORY_COLORS.academic;
            const CatIcon = cat.icon;
            return (
              <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cat.bg} ${cat.text}`}>
                    <CatIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-zinc-900">{a.title}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${cat.bg} ${cat.text}`}>{a.category}</span>
                    </div>
                    {a.description && <p className="mt-1 text-sm text-zinc-600">{a.description}</p>}
                    {a.award_date && <p className="mt-2 text-xs text-zinc-400">{new Date(a.award_date).toLocaleDateString()}</p>}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
