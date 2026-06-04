"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, gql } from "@apollo/client";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { Settings as SettingsIcon, Save, Loader2 } from "lucide-react";
import { getInstitutionIdFromStorage } from "@/lib/tenant";

const GET_SETTINGS = gql`
  query GetSettings {
    allInstitutionSettings {
      nodes {
        institutionId
        attendanceThreshold
        feeBlockEnabled
        feeThreshold
        academicYearStart
        academicYearEnd
      }
    }
  }
`;

const UPSERT_SETTINGS = gql`
  mutation UpsertSettings(
    $institutionId: UUID!
    $attendanceThreshold: BigFloat
    $feeBlockEnabled: Boolean
    $feeThreshold: BigFloat
    $academicYearStart: Date
    $academicYearEnd: Date
  ) {
    upsertInstitutionSettings(
      input: {
        pInstitutionId: $institutionId
        pAttendanceThreshold: $attendanceThreshold
        pFeeBlockEnabled: $feeBlockEnabled
        pFeeThreshold: $feeThreshold
        pAcademicYearStart: $academicYearStart
        pAcademicYearEnd: $academicYearEnd
      }
    ) {
      institutionSetting {
        institutionId
        attendanceThreshold
        feeBlockEnabled
        feeThreshold
        academicYearStart
        academicYearEnd
      }
    }
  }
`;

export default function SettingsPage() {
  const { data, loading, refetch } = useQuery(GET_SETTINGS);
  const [upsert, { loading: saving }] = useMutation(UPSERT_SETTINGS);
  const [form, setForm] = useState({
    attendanceThreshold: 75,
    feeBlockEnabled: true,
    feeThreshold: 0,
    academicYearStart: "",
    academicYearEnd: "",
  });

  useEffect(() => {
    const s = data?.allInstitutionSettings?.nodes?.[0];
    if (s) {
      setForm({
        attendanceThreshold: Number(s.attendanceThreshold ?? 75),
        feeBlockEnabled: s.feeBlockEnabled ?? true,
        feeThreshold: Number(s.feeThreshold ?? 0),
        academicYearStart: s.academicYearStart || "",
        academicYearEnd: s.academicYearEnd || "",
      });
    }
  }, [data]);

  const onSave = async (e) => {
    e.preventDefault();
    const institutionId = getInstitutionIdFromStorage();
    if (!institutionId) return toast.error("No institution context");
    try {
      await upsert({
        variables: {
          institutionId,
          attendanceThreshold: form.attendanceThreshold,
          feeBlockEnabled: form.feeBlockEnabled,
          feeThreshold: form.feeThreshold,
          academicYearStart: form.academicYearStart || null,
          academicYearEnd: form.academicYearEnd || null,
        },
      });
      toast.success("Settings saved");
      refetch();
    } catch (err) {
      toast.error(err.message || "Failed to save");
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
          <SettingsIcon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">School Settings</h1>
          <p className="text-sm text-zinc-500">Eligibility thresholds and academic year.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={onSave}
          className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label className="block text-sm font-semibold text-zinc-700">
              Attendance eligibility threshold (%)
            </label>
            <p className="mb-2 text-xs text-zinc-500">
              Minimum attendance required for exam eligibility / admit cards.
            </p>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={form.attendanceThreshold}
              onChange={(e) =>
                setForm((f) => ({ ...f, attendanceThreshold: Number(e.target.value) }))
              }
              className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-4">
            <div>
              <p className="text-sm font-semibold text-zinc-700">Block admit cards on pending fees</p>
              <p className="text-xs text-zinc-500">Require fees cleared before exam admit cards.</p>
            </div>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, feeBlockEnabled: !f.feeBlockEnabled }))}
              className={`relative h-6 w-11 rounded-full transition ${
                form.feeBlockEnabled ? "bg-primary-600" : "bg-zinc-300"
              }`}
              aria-pressed={form.feeBlockEnabled}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                  form.feeBlockEnabled ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>

          <div>
            <label className="block text-sm font-semibold text-zinc-700">
              Allowed pending fee amount
            </label>
            <p className="mb-2 text-xs text-zinc-500">
              Outstanding fees up to this amount still allow admit cards.
            </p>
            <input
              type="number"
              min="0"
              step="1"
              value={form.feeThreshold}
              onChange={(e) => setForm((f) => ({ ...f, feeThreshold: Number(e.target.value) }))}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-zinc-700">Academic year start</label>
              <input
                type="date"
                value={form.academicYearStart}
                onChange={(e) =>
                  setForm((f) => ({ ...f, academicYearStart: e.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-700">Academic year end</label>
              <input
                type="date"
                value={form.academicYearEnd}
                onChange={(e) => setForm((f) => ({ ...f, academicYearEnd: e.target.value }))}
                className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save settings
          </button>
        </motion.form>
      )}
    </div>
  );
}
