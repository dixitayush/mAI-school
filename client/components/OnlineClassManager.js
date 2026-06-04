"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, gql } from "@apollo/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video,
  Plus,
  Loader2,
  X,
  Pencil,
  Trash2,
  Clock,
  Calendar,
  ExternalLink,
  Users,
} from "lucide-react";
import { toast } from "react-hot-toast";

const GET_CLASSES = gql`
  query OnlineClassClasses {
    allClasses(orderBy: NAME_ASC) {
      nodes {
        id
        name
        teacherId
      }
    }
  }
`;

const GET_ONLINE_CLASSES = gql`
  query OnlineClasses {
    allOnlineClasses(orderBy: CLASS_DATE_DESC) {
      nodes {
        id
        classId
        title
        description
        classDate
        startTime
        endTime
        meetingLink
        provider
        section
        classByClassId {
          name
        }
        userByTeacherId {
          fullName
        }
      }
    }
  }
`;

const CREATE = gql`
  mutation CreateOnlineClass(
    $classId: UUID!
    $title: String!
    $classDate: Date!
    $meetingLink: String!
    $startTime: Time
    $endTime: Time
    $provider: String
    $description: String
    $section: String
  ) {
    createOnlineClass(
      input: {
        pClassId: $classId
        pTitle: $title
        pClassDate: $classDate
        pMeetingLink: $meetingLink
        pStartTime: $startTime
        pEndTime: $endTime
        pProvider: $provider
        pDescription: $description
        pSection: $section
      }
    ) {
      onlineClass {
        id
      }
    }
  }
`;

const UPDATE = gql`
  mutation UpdateOnlineClass(
    $id: UUID!
    $title: String!
    $classDate: Date!
    $meetingLink: String!
    $startTime: Time
    $endTime: Time
    $provider: String
    $description: String
    $section: String
  ) {
    updateOnlineClass(
      input: {
        pId: $id
        pTitle: $title
        pClassDate: $classDate
        pMeetingLink: $meetingLink
        pStartTime: $startTime
        pEndTime: $endTime
        pProvider: $provider
        pDescription: $description
        pSection: $section
      }
    ) {
      onlineClass {
        id
      }
    }
  }
`;

const DELETE = gql`
  mutation DeleteOnlineClass($id: UUID!) {
    deleteOnlineClass(input: { pId: $id }) {
      uuid
    }
  }
`;

const emptyForm = {
  classId: "",
  title: "",
  classDate: "",
  startTime: "",
  endTime: "",
  provider: "meet",
  meetingLink: "",
  description: "",
  section: "",
};

const providerStyle = {
  zoom: "bg-blue-100 text-blue-700",
  meet: "bg-green-100 text-green-700",
  custom: "bg-zinc-100 text-zinc-600",
};

export default function OnlineClassManager({ teacherId = null }) {
  const { data: cData } = useQuery(GET_CLASSES);
  const classes = useMemo(() => {
    const all = cData?.allClasses?.nodes || [];
    return teacherId ? all.filter((c) => c.teacherId === teacherId) : all;
  }, [cData, teacherId]);
  const classIds = useMemo(() => new Set(classes.map((c) => c.id)), [classes]);

  const { data, loading, refetch } = useQuery(GET_ONLINE_CLASSES, {
    fetchPolicy: "cache-and-network",
  });
  const sessions = (data?.allOnlineClasses?.nodes || []).filter((s) =>
    teacherId ? classIds.has(s.classId) : true
  );

  const [createOnlineClass] = useMutation(CREATE);
  const [updateOnlineClass] = useMutation(UPDATE);
  const [deleteOnlineClass] = useMutation(DELETE);

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setForm({ ...emptyForm, classId: classes[0]?.id || "" });
    setEditing({});
  };
  const openEdit = (s) => {
    setForm({
      classId: s.classId,
      title: s.title || "",
      classDate: s.classDate || "",
      startTime: s.startTime ? s.startTime.slice(0, 5) : "",
      endTime: s.endTime ? s.endTime.slice(0, 5) : "",
      provider: s.provider || "custom",
      meetingLink: s.meetingLink || "",
      description: s.description || "",
      section: s.section || "",
    });
    setEditing(s);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.classId) return toast.error("Select a class");
    if (!form.title.trim()) return toast.error("Title is required");
    if (!form.classDate) return toast.error("Date is required");
    if (!form.meetingLink.trim()) return toast.error("Meeting link is required");
    const common = {
      title: form.title.trim(),
      classDate: form.classDate,
      meetingLink: form.meetingLink.trim(),
      startTime: form.startTime || null,
      endTime: form.endTime || null,
      provider: form.provider,
      description: form.description.trim() || null,
      section: form.section.trim() || null,
    };
    setSaving(true);
    try {
      if (editing?.id) {
        await updateOnlineClass({ variables: { id: editing.id, ...common } });
      } else {
        await createOnlineClass({ variables: { classId: form.classId, ...common } });
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
    if (!window.confirm("Delete this online class?")) return;
    try {
      await deleteOnlineClass({ variables: { id } });
      toast.success("Deleted");
      await refetch();
    } catch (err) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
            <Video className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Online Classes</h1>
            <p className="text-sm text-zinc-500">Schedule live sessions for your classes.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={openNew}
          disabled={classes.length === 0}
          className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Schedule
        </button>
      </div>

      {loading && !data ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-xl border border-zinc-100 bg-white py-16 text-center text-zinc-500">
          No online classes scheduled.
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => {
            const upcoming = s.classDate >= todayStr;
            return (
              <div
                key={s.id}
                className={`rounded-2xl border bg-white p-4 ${upcoming ? "border-primary-100" : "border-zinc-100 opacity-80"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-zinc-900">{s.title}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${providerStyle[s.provider]}`}>
                        {s.provider}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {s.classByClassId?.name}
                        {s.section ? ` · ${s.section}` : ""}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(`${s.classDate}T00:00:00`).toLocaleDateString()}
                      </span>
                      {(s.startTime || s.endTime) && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {s.startTime?.slice(0, 5)}
                          {s.endTime ? `–${s.endTime.slice(0, 5)}` : ""}
                        </span>
                      )}
                    </div>
                    {s.description && <p className="mt-2 text-sm text-zinc-600">{s.description}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <a
                      href={s.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open
                    </a>
                    <button type="button" onClick={() => openEdit(s)} aria-label="edit">
                      <Pencil className="h-4 w-4 text-zinc-400 hover:text-primary-600" />
                    </button>
                    <button type="button" onClick={() => handleDelete(s.id)} aria-label="delete">
                      <Trash2 className="h-4 w-4 text-zinc-400 hover:text-red-600" />
                    </button>
                  </div>
                </div>
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
              className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-zinc-900">
                  {editing?.id ? "Edit online class" : "Schedule online class"}
                </h2>
                <button type="button" onClick={() => setEditing(null)}>
                  <X className="h-5 w-5 text-zinc-400" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Class</label>
                  <select
                    value={form.classId}
                    onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}
                    disabled={!!editing?.id}
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none disabled:bg-zinc-50"
                  >
                    <option value="">Select class…</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Title</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Date</label>
                  <input
                    type="date"
                    value={form.classDate}
                    onChange={(e) => setForm((f) => ({ ...f, classDate: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Provider</label>
                  <select
                    value={form.provider}
                    onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  >
                    <option value="meet">Google Meet</option>
                    <option value="zoom">Zoom</option>
                    <option value="custom">Custom</option>
                  </select>
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
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Meeting link</label>
                  <input
                    type="url"
                    placeholder="https://…"
                    value={form.meetingLink}
                    onChange={(e) => setForm((f) => ({ ...f, meetingLink: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Description</label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Section (optional)</label>
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
