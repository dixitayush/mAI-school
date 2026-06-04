"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, gql } from "@apollo/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarClock,
  Plus,
  Loader2,
  X,
  Pencil,
  Trash2,
  Clock,
  MapPin,
  User,
} from "lucide-react";
import { toast } from "react-hot-toast";

const DAYS = [
  { n: 1, label: "Mon" },
  { n: 2, label: "Tue" },
  { n: 3, label: "Wed" },
  { n: 4, label: "Thu" },
  { n: 5, label: "Fri" },
  { n: 6, label: "Sat" },
  { n: 0, label: "Sun" },
];

const GET_CLASSES = gql`
  query TimetableClasses {
    allClasses(orderBy: NAME_ASC) {
      nodes {
        id
        name
        teacherId
      }
    }
    allTeachers {
      nodes {
        userByUserId {
          id
          fullName
        }
      }
    }
  }
`;

const GET_PERIODS = gql`
  query TimetablePeriods($classId: UUID!) {
    allTimetablePeriods(condition: { classId: $classId }, orderBy: PERIOD_NO_ASC) {
      nodes {
        id
        dayOfWeek
        periodNo
        subject
        startTime
        endTime
        room
        section
        teacherId
        userByTeacherId {
          fullName
        }
      }
    }
  }
`;

const CREATE_PERIOD = gql`
  mutation CreatePeriod(
    $classId: UUID!
    $dayOfWeek: Int!
    $periodNo: Int!
    $subject: String!
    $startTime: Time
    $endTime: Time
    $teacherId: UUID
    $room: String
    $section: String
  ) {
    createTimetablePeriod(
      input: {
        pClassId: $classId
        pDayOfWeek: $dayOfWeek
        pPeriodNo: $periodNo
        pSubject: $subject
        pStartTime: $startTime
        pEndTime: $endTime
        pTeacherId: $teacherId
        pRoom: $room
        pSection: $section
      }
    ) {
      timetablePeriod {
        id
      }
    }
  }
`;

const UPDATE_PERIOD = gql`
  mutation UpdatePeriod(
    $id: UUID!
    $dayOfWeek: Int!
    $periodNo: Int!
    $subject: String!
    $startTime: Time
    $endTime: Time
    $teacherId: UUID
    $room: String
    $section: String
  ) {
    updateTimetablePeriod(
      input: {
        pId: $id
        pDayOfWeek: $dayOfWeek
        pPeriodNo: $periodNo
        pSubject: $subject
        pStartTime: $startTime
        pEndTime: $endTime
        pTeacherId: $teacherId
        pRoom: $room
        pSection: $section
      }
    ) {
      timetablePeriod {
        id
      }
    }
  }
`;

const DELETE_PERIOD = gql`
  mutation DeletePeriod($id: UUID!) {
    deleteTimetablePeriod(input: { pId: $id }) {
      uuid
    }
  }
`;

const emptyForm = {
  dayOfWeek: 1,
  periodNo: 1,
  subject: "",
  startTime: "",
  endTime: "",
  teacherId: "",
  room: "",
  section: "",
};

export default function TimetableManager() {
  const { data: cData, loading: cLoading } = useQuery(GET_CLASSES);
  // Timetables are a school-wide resource; show every class in the tenant
  // (RLS already scopes this to the user's institution). Filtering to only a
  // teacher's "own" class left non-class-teachers with an empty dropdown.
  const classes = useMemo(() => cData?.allClasses?.nodes || [], [cData]);
  const teachers = cData?.allTeachers?.nodes?.map((t) => t.userByUserId).filter(Boolean) || [];

  const [classId, setClassId] = useState("");
  const { data, loading, refetch } = useQuery(GET_PERIODS, {
    variables: { classId },
    skip: !classId,
    fetchPolicy: "cache-and-network",
  });
  const periods = data?.allTimetablePeriods?.nodes || [];

  const [createPeriod] = useMutation(CREATE_PERIOD);
  const [updatePeriod] = useMutation(UPDATE_PERIOD);
  const [deletePeriod] = useMutation(DELETE_PERIOD);

  const [editing, setEditing] = useState(null); // null | {} (new) | period (edit)
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const openNew = (dayOfWeek) => {
    setForm({ ...emptyForm, dayOfWeek });
    setEditing({});
  };
  const openEdit = (p) => {
    setForm({
      dayOfWeek: p.dayOfWeek,
      periodNo: p.periodNo,
      subject: p.subject || "",
      startTime: p.startTime ? p.startTime.slice(0, 5) : "",
      endTime: p.endTime ? p.endTime.slice(0, 5) : "",
      teacherId: p.teacherId || "",
      room: p.room || "",
      section: p.section || "",
    });
    setEditing(p);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.subject.trim()) return toast.error("Subject is required");
    const vars = {
      dayOfWeek: Number(form.dayOfWeek),
      periodNo: Number(form.periodNo),
      subject: form.subject.trim(),
      startTime: form.startTime || null,
      endTime: form.endTime || null,
      teacherId: form.teacherId || null,
      room: form.room.trim() || null,
      section: form.section.trim() || null,
    };
    setSaving(true);
    try {
      if (editing?.id) {
        await updatePeriod({ variables: { id: editing.id, ...vars } });
      } else {
        await createPeriod({ variables: { classId, ...vars } });
      }
      toast.success("Saved");
      setEditing(null);
      await refetch();
    } catch (err) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this period?")) return;
    try {
      await deletePeriod({ variables: { id } });
      toast.success("Deleted");
      await refetch();
    } catch (err) {
      toast.error(err.message || "Failed to delete");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
          <CalendarClock className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Timetable</h1>
          <p className="text-sm text-zinc-500">Build the weekly class schedule.</p>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500">Class</label>
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          disabled={cLoading}
          className="min-w-[240px] rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
        >
          <option value="">Select class…</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {!classId ? (
        <div className="rounded-xl border border-zinc-100 bg-white py-16 text-center text-zinc-500">
          Select a class to manage its timetable.
        </div>
      ) : loading && !data ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {DAYS.map((d) => {
            const dayPeriods = periods
              .filter((p) => p.dayOfWeek === d.n)
              .sort((a, b) => a.periodNo - b.periodNo);
            return (
              <div key={d.n} className="rounded-2xl border border-zinc-100 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-700">{d.label}</h3>
                  <button
                    type="button"
                    onClick={() => openNew(d.n)}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary-50 px-2 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-100"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </button>
                </div>
                {dayPeriods.length === 0 ? (
                  <p className="py-3 text-center text-xs text-zinc-400">No periods</p>
                ) : (
                  <div className="space-y-2">
                    {dayPeriods.map((p) => (
                      <div key={p.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-zinc-800">
                              {p.periodNo}. {p.subject}
                            </p>
                            <div className="mt-1 space-y-0.5 text-xs text-zinc-500">
                              {(p.startTime || p.endTime) && (
                                <p className="inline-flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {p.startTime?.slice(0, 5)}
                                  {p.endTime ? `–${p.endTime.slice(0, 5)}` : ""}
                                </p>
                              )}
                              {p.userByTeacherId && (
                                <p className="inline-flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {p.userByTeacherId.fullName}
                                </p>
                              )}
                              {p.room && (
                                <p className="inline-flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {p.room}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <button type="button" onClick={() => openEdit(p)} aria-label="edit">
                              <Pencil className="h-3.5 w-3.5 text-zinc-400 hover:text-primary-600" />
                            </button>
                            <button type="button" onClick={() => handleDelete(p.id)} aria-label="delete">
                              <Trash2 className="h-3.5 w-3.5 text-zinc-400 hover:text-red-600" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setEditing(null)}
          >
            <motion.form
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSave}
              className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-zinc-900">
                  {editing?.id ? "Edit period" : "Add period"}
                </h2>
                <button type="button" onClick={() => setEditing(null)}>
                  <X className="h-5 w-5 text-zinc-400" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Day</label>
                  <select
                    value={form.dayOfWeek}
                    onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  >
                    {DAYS.map((d) => (
                      <option key={d.n} value={d.n}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Period #</label>
                  <input
                    type="number"
                    min={1}
                    value={form.periodNo}
                    onChange={(e) => setForm((f) => ({ ...f, periodNo: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Subject</label>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Start</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">End</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Teacher</label>
                  <select
                    value={form.teacherId}
                    onChange={(e) => setForm((f) => ({ ...f, teacherId: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  >
                    <option value="">— None —</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Room</label>
                  <input
                    type="text"
                    value={form.room}
                    onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Section</label>
                  <input
                    type="text"
                    value={form.section}
                    onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Save
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
