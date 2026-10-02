"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import {
  Brain,
  Loader2,
  DollarSign,
  Zap,
  TrendingUp,
  AlertTriangle,
  Timer,
  RefreshCw,
  GraduationCap,
  Save,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const RANGES = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

/** Costs come back from the API in whole USD (not cents). */
const usd = (n) => `$${Number(n || 0).toFixed(Number(n || 0) > 0 && Number(n) < 0.01 ? 4 : 2)}`;
const compactTokens = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
};

export default function AIGovernancePage() {
  const [usage, setUsage] = useState(null);
  const [limits, setLimits] = useState(null);
  const [configured, setConfigured] = useState(true);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    (range) => {
      setLoading(true);
      apiFetch(`/api/ai/usage?days=${range}`)
        .then((data) => {
          setUsage(data?.stats || null);
          setLimits(data?.limits || null);
          setConfigured(data?.configured !== false);
        })
        .catch((err) => toast.error(err.message))
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => {
    load(days);
  }, [days, load]);

  const byFeature = Object.entries(usage?.by_feature || {});
  const byTier = usage?.by_tier || [];
  const daily = usage?.daily || [];
  const maxDailyRequests = Math.max(1, ...daily.map((d) => Number(d.requests) || 0));
  const hasAnyUsage = (usage?.total_requests || 0) > 0;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
            <Brain className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">AI Cost Governance</h1>
            <p className="text-sm text-zinc-500">Monitor AI usage, cost and quota consumption.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-zinc-200 bg-white p-1 shadow-sm">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setDays(r.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  days === r.value ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => load(days)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 shadow-sm hover:bg-zinc-50"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!configured && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            No AI provider key is configured on the server, so new AI requests will fail. Set{" "}
            <code className="rounded bg-amber-100 px-1">OPENAI_API_KEY</code> (or{" "}
            <code className="rounded bg-amber-100 px-1">GEMINI_API_KEY</code>) to enable AI features.
          </span>
        </div>
      )}

      <StudentLimitCard />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading...
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<Zap className="h-5 w-5" />}
              tone="emerald"
              value={usage?.total_requests ?? 0}
              label="Total Requests"
            />
            <StatCard
              icon={<DollarSign className="h-5 w-5" />}
              tone="amber"
              value={usd(usage?.total_cost)}
              label="Estimated Cost"
            />
            <StatCard
              icon={<TrendingUp className="h-5 w-5" />}
              tone="blue"
              value={compactTokens(usage?.total_tokens)}
              label="Total Tokens"
            />
            <StatCard
              icon={<Timer className="h-5 w-5" />}
              tone="zinc"
              value={`${usage?.avg_latency_ms ?? 0} ms`}
              label="Avg Latency"
            />
          </div>

          {limits && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <QuotaCard
                label="School daily quota"
                limit={limits.daily_tenant_limit}
                note={`${usage?.errors ?? 0} errors, ${usage?.timeouts ?? 0} timeouts in this window`}
              />
              <QuotaCard label="Per-user daily quota" limit={limits.daily_user_limit} note="Applies to each account" />
            </div>
          )}

          {!hasAnyUsage ? (
            <div className="rounded-2xl border border-zinc-200 bg-white py-16 text-center text-sm text-zinc-400 shadow-sm">
              No AI requests recorded in the last {days} days.
            </div>
          ) : (
            <>
              {byTier.length > 0 && (
                <Panel title="Usage by Model Tier">
                  {byTier.map((t) => (
                    <Row
                      key={t.tier}
                      title={t.tier}
                      subtitle={`${t.count} requests`}
                      right={usd(t.cost)}
                    />
                  ))}
                </Panel>
              )}

              {byFeature.length > 0 && (
                <Panel title="Usage by Feature">
                  {byFeature.map(([feature, data]) => (
                    <Row
                      key={feature}
                      title={feature.replace(/[._]/g, " ")}
                      subtitle={`${data.count || 0} requests · ${compactTokens(data.tokens)} tokens${
                        data.errors ? ` · ${data.errors} errors` : ""
                      }`}
                      right={usd(data.cost)}
                    />
                  ))}
                </Panel>
              )}

              {daily.length > 0 && (
                <Panel title={`Daily Usage (last ${days} days)`}>
                  {daily.slice(0, 14).map((day) => (
                    <div key={day.date} className="flex items-center gap-4 px-5 py-3">
                      <p className="w-24 shrink-0 text-sm font-medium text-zinc-800">
                        {new Date(`${day.date}T00:00:00`).toLocaleDateString()}
                      </p>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full bg-violet-500"
                          style={{ width: `${((day.requests || 0) / maxDailyRequests) * 100}%` }}
                        />
                      </div>
                      <div className="w-32 shrink-0 text-right">
                        <p className="text-sm font-semibold text-zinc-900">{day.requests || 0} req</p>
                        <p className="text-xs text-zinc-500">{usd(day.cost)}</p>
                      </div>
                    </div>
                  ))}
                </Panel>
              )}
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}

const TONES = {
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  blue: "bg-blue-50 text-blue-700",
  zinc: "bg-zinc-100 text-zinc-700",
};

function StatCard({ icon, tone, value, label }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${TONES[tone]}`}>{icon}</div>
      <p className="text-2xl font-bold text-zinc-900">{value}</p>
      <p className="text-xs font-medium text-zinc-500">{label}</p>
    </div>
  );
}

function QuotaCard({ label, limit, note }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-zinc-900">{limit} requests / day</p>
      <p className="mt-1 text-xs text-zinc-500">{note}</p>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-5 py-4">
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      </div>
      <div className="divide-y divide-zinc-100">{children}</div>
    </div>
  );
}

function Row({ title, subtitle, right }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <div>
        <p className="text-sm font-medium capitalize text-zinc-800">{title}</p>
        <p className="text-xs text-zinc-500">{subtitle}</p>
      </div>
      <p className="text-sm font-semibold text-zinc-900">{right}</p>
    </div>
  );
}

/**
 * How many AI answers each student gets per day (AI Tutor + Study Planner
 * combined). Resets at midnight in the school's time zone.
 */
function StudentLimitCard() {
  const [config, setConfig] = useState(null);
  const [value, setValue] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/api/ai/student-limit")
      .then((d) => { setConfig(d); setValue(d.limit); })
      .catch((err) => toast.error(err.message));
  }, []);

  if (!config) return null;
  const options = Array.from({ length: config.max - config.min + 1 }, (_, i) => config.min + i);
  const dirty = value !== config.limit;

  const save = async () => {
    setSaving(true);
    try {
      const d = await apiFetch("/api/ai/student-limit", { method: "PUT", body: { limit: value } });
      setConfig(d);
      setValue(d.limit);
      toast.success(`Students can now ask AI ${d.limit} times a day`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Student daily AI limit</h2>
            <p className="mt-0.5 max-w-md text-xs text-zinc-500">
              AI answers each student can get per day across AI Tutor and Study Planner. Students see how many
              are left and a countdown; it resets at midnight ({config.timezone}). Only answers count — failed requests don&apos;t.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-zinc-200 bg-zinc-50 p-1" role="radiogroup" aria-label="Attempts per day">
            {options.map((n) => (
              <button
                key={n}
                role="radio"
                aria-checked={value === n}
                onClick={() => setValue(n)}
                className={`h-9 w-9 rounded-lg text-sm font-semibold transition ${
                  value === n ? "bg-emerald-600 text-white shadow-sm" : "text-zinc-600 hover:bg-white"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="flex h-11 items-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}
