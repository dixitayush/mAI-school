"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { ToggleRight, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

const FLAG_LABELS = {
  AI_TUTOR: "AI Tutor",
  AI_TEACHER_STUDIO: "AI Teacher Studio",
  AI_PRINCIPAL_INSIGHTS: "AI Principal Insights",
  PARENT_PORTAL: "Parent Portal",
  TRANSPORT: "Transport Management",
  LIBRARY: "Library Management",
  ADMISSIONS: "Admissions",
  WORKFLOWS: "Approval Workflows",
  PWA_OFFLINE: "PWA Offline Mode",
  HELPDESK: "Help Desk",
  SURVEYS: "Surveys",
  CONSENT: "Consent Management",
  INVENTORY: "Inventory",
  INTERVENTIONS: "Student Interventions",
};

const FLAG_DESCRIPTIONS = {
  AI_TUTOR: "Allow students to interact with the AI tutoring assistant.",
  AI_TEACHER_STUDIO: "AI-powered lesson planning and content generation for teachers.",
  AI_PRINCIPAL_INSIGHTS: "AI-generated school analytics and insights for principals.",
  PARENT_PORTAL: "Enable the parent-facing portal for fee payments and progress tracking.",
  TRANSPORT: "Track school buses, routes, and student pickup/drop-off.",
  LIBRARY: "Manage books, issue tracking, and library cards.",
  ADMISSIONS: "Online admission forms, applications, and enrollment workflow.",
  WORKFLOWS: "Multi-step approval workflows for leave, expenses, etc.",
  PWA_OFFLINE: "Allow the app to work offline with local data sync.",
  HELPDESK: "Internal ticketing system for IT and admin support.",
  SURVEYS: "Create and distribute surveys to students, parents, and staff.",
  CONSENT: "Manage parental consent forms for trips, photos, etc.",
  INVENTORY: "Track school inventory, assets, and procurement.",
  INTERVENTIONS: "Flag at-risk students and track support interventions.",
};

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState({});
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);

  useEffect(() => {
    apiFetch("/api/feature-flags")
      .then((data) => setFlags(data.flags || {}))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (flag) => {
    setToggling(flag);
    try {
      const data = await apiFetch(`/api/feature-flags/${flag}`, {
        method: "PATCH",
        body: { enabled: !flags[flag] },
      });
      setFlags((f) => ({ ...f, [flag]: data.enabled }));
      toast.success(`${FLAG_LABELS[flag] || flag} ${data.enabled ? "enabled" : "disabled"}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
          <ToggleRight className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Feature Flags</h1>
          <p className="text-sm text-zinc-500">Enable or disable modules for your institution.</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        {Object.entries(flags).map(([flag, enabled]) => (
          <div
            key={flag}
            className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <div className="min-w-0 pr-4">
              <p className="text-sm font-semibold text-zinc-900">{FLAG_LABELS[flag] || flag}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{FLAG_DESCRIPTIONS[flag] || ""}</p>
            </div>
            <button
              type="button"
              onClick={() => toggle(flag)}
              disabled={toggling === flag}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                enabled ? "bg-primary-600" : "bg-zinc-300"
              } ${toggling === flag ? "opacity-60" : ""}`}
              aria-pressed={enabled}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                  enabled ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
